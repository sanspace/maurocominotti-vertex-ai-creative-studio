import asyncio
import logging
import time
import tempfile
from typing import Optional

from fastapi import UploadFile

from src.common.storage_service import GcsService
from src.config.config_service import config_service
from src.images.repository.media_item_repository import MediaRepository  # reuse media repo used for images
from src.common.schema.media_item_model import MediaItemModel, JobStatusEnum, MimeTypeEnum
from src.galleries.dto.gallery_response_dto import MediaItemResponse  # for parity; not required here
from src.audios.chirp_client import ChirpClient
from src.audios.dto.transcribe_response_dto import TranscribeResponseDto
from src.users.user_model import UserModel

logger = logging.getLogger(__name__)


class ChirpService:
    """
    Service that follows the same 11-step flow used by images, adapted for STT:
      1. Start timer and initialize dependencies
      2. Optionally enhance text input (kept as pattern for parity; not usually needed for raw audio)
      3. Save uploaded file to temp
      4. Upload to GCS (or pass bytes directly)
      5. Call Chirp STT (via ChirpClient)
      6. Receive transcription text and any metadata
      7. Persist a MediaItem (or Transcript record) with metadata
      8. Generate a presigned URL pointing to the audio file for playback/download
      9. Return TranscribeResponseDto
    """

    def __init__(self):
        self.gcs_service = GcsService()
        self.media_repo = MediaRepository()
        self.cfg = config_service
        self.chirp_client = ChirpClient(api_key=self.cfg.CHIRP_API_KEY if hasattr(self.cfg, "CHIRP_API_KEY") else None)

    async def transcribe_file(
        self,
        workspace_id: str,
        upload_file: UploadFile,
        user: UserModel,
        use_enhancer: bool = False,
        language_hint: Optional[str] = None,
    ) -> TranscribeResponseDto | None:
        start_time = time.monotonic()

        # Step 3: Save incoming UploadFile to a temp file to work with bytes easily.
        try:
            suffix = ""
            if upload_file.filename and "." in upload_file.filename:
                suffix = "." + upload_file.filename.rsplit(".", 1)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                contents = await upload_file.read()  # read all bytes
                tmp.write(contents)
                tmp.flush()
                tmp_path = tmp.name

            # Step 4: Upload to GCS so we have persistent storage for the uploaded audio
            bucket_name = getattr(self.gcs_service, "bucket_name", None) or self.cfg.GENMEDIA_BUCKET
            gcs_output_path = f"audio_uploads/{workspace_id}/{upload_file.filename or 'upload'}"
            gcs_uri = await asyncio.to_thread(self.gcs_service.upload_bytes, contents, gcs_output_path)

            # Step 5: Call Chirp STT with bytes or GCS URI. Use bytes if you need immediate transcription and do not want remote fetch.
            # If chirp supports remote URIs, you can call transcribe_gcs_uri instead.
            # Use asyncio.to_thread to avoid blocking the event loop if chirp_client is synchronous.
            transcription = await asyncio.to_thread(self.chirp_client.transcribe_bytes, contents, upload_file.filename or "")

            # Step 6: Validate transcription
            if not transcription:
                raise ValueError("Transcription returned empty result from Chirp model.")

            # Step 7: Persist a record (reuse MediaItemModel pattern used for generated media).
            end_time = time.monotonic()
            generation_time = end_time - start_time

            # Choose mime type based on upload file content-type if available
            mime_type = MimeTypeEnum.AUDIO_MPEG if (upload_file.content_type and "mpeg" in upload_file.content_type) else MimeTypeEnum.AUDIO_WAV if (upload_file.content_type and "wav" in upload_file.content_type) else MimeTypeEnum.AUDIO_UNKNOWN if hasattr(MimeTypeEnum, "AUDIO_UNKNOWN") else MimeTypeEnum.AUDIO_MPEG

            # Build a media-like model to store transcription metadata.
            media_item = MediaItemModel(
                workspace_id=workspace_id,
                user_email=user.email,
                user_id=user.id,
                mime_type=mime_type,
                model="chirp-stt",  # indicate which model did the transcription
                prompt="",  # no prompt for audio STT, keep parity with other models
                original_prompt="",
                num_media=1,
                generation_time=generation_time,
                gcs_uris=[gcs_uri] if gcs_uri else None,
                status=JobStatusEnum.COMPLETED,
                # store transcription text in a dedicated field if available, else reuse an existing field
                # If MediaItemModel does not have a dedicated field, consider extending the model to add 'transcription_text'.
            )

            # If MediaItemModel supports custom fields for metadata, set them. If not, we may need a new TranscriptModel.
            # For demonstration, try to attach transcription to a 'metadata' property if it exists, else skip.
            try:
                # many Pydantic/ORM models allow arbitrary extra data via a dict; adjust according to your actual schema.
                setattr(media_item, "transcription_text", transcription)
            except Exception:
                logger.debug("MediaItemModel doesn't accept dynamic 'transcription_text' attribute; transcription will not be stored there automatically.")

            # Save the media item (this may persist and assign an ID)
            await asyncio.to_thread(self.media_repo.save, media_item)

            # Step 8: Create presigned URL for the uploaded audio for frontend playback
            presigned_url = await asyncio.to_thread(self.gcs_service.generate_presigned_url, gcs_uri) if gcs_uri else None

            # Step 9: Build and return a TranscribeResponseDto
            response = TranscribeResponseDto(
                id=getattr(media_item, "id", None),
                workspace_id=workspace_id,
                user_id=user.id,
                user_email=user.email,
                model="chirp-stt",
                transcription_text=transcription,
                gcs_uri=gcs_uri,
                presigned_url=presigned_url,
                generation_time_seconds=generation_time,
            )
            return response

        except Exception as e:
            logger.error(f"ChirpService.transcribe_file failed: {e}")
            raise
        finally:
            # Cleanup temp file if desired. We created tmp_path above.
            try:
                import os
                if 'tmp_path' in locals() and os.path.exists(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                logger.debug("Could not remove temp file; continuing.")