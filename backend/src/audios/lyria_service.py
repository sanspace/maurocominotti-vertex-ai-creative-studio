# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import asyncio
import base64
import logging
import time
from typing import List

from google.cloud import aiplatform

from src.audios.dto.create_lyria_dto import CreateLyriaDto
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.common.base_dto import MimeTypeEnum
from src.common.schema.media_item_model import JobStatusEnum, MediaItemModel
from src.common.storage_service import GcsService
from src.config.config_service import config_service
from src.galleries.dto.gallery_response_dto import MediaItemResponse
from src.images.repository.media_item_repository import MediaRepository
from src.users.user_model import UserModel

logger = logging.getLogger(__name__)


class LyriaService:
    def __init__(self):
        """Initializes the service with its dependencies."""
        self.iam_signer_credentials = IamSignerCredentials()
        self.media_repo = MediaRepository()
        self.gcs_service = GcsService()
        self.cfg = config_service

    async def generate_audio(
        self, request_dto: CreateLyriaDto, user: UserModel
    ) -> MediaItemResponse | None:
        """
        Generates a batch of audio and saves them as a single MediaItem document.
        """
        start_time = time.monotonic()

        client_options = {
            "api_endpoint": f"{self.cfg.LOCATION}-aiplatform.googleapis.com"
        }
        client = aiplatform.gapic.PredictionServiceClient(
            client_options=client_options
        )

        instance = {
            "prompt": request_dto.prompt,
        }
        if request_dto.negative_prompt:
            instance["negative_prompt"] = request_dto.negative_prompt
        if request_dto.seed:
            instance["seed"] = request_dto.seed

        parameters = {"sampleCount": request_dto.sample_count}

        try:
            response = await asyncio.to_thread(
                client.predict,
                endpoint=f"projects/{self.cfg.PROJECT_ID}/locations/{self.cfg.LOCATION}/publishers/google/models/lyria-002",
                instances=[instance],
                parameters=parameters,
            )

            if not response.predictions:
                return None

            permanent_gcs_uris: List[str] = []
            for prediction in response.predictions:
                audio_content = prediction.get("bytesBase64Encoded")
                if audio_content:
                    audio_bytes = base64.b64decode(audio_content)
                    file_name = f"lyria_audio_{int(time.time())}.wav"
                    gcs_uri = self.gcs_service.store_to_gcs(
                        folder="lyria_audio",
                        file_name=file_name,
                        mime_type=MimeTypeEnum.AUDIO_WAV,
                        contents=audio_bytes,
                        decode=False,
                    )
                    permanent_gcs_uris.append(gcs_uri)

            if not permanent_gcs_uris:
                return None

            presigned_url_tasks = [
                asyncio.to_thread(
                    self.iam_signer_credentials.generate_presigned_url, uri
                )
                for uri in permanent_gcs_uris
            ]
            presigned_urls = await asyncio.gather(*presigned_url_tasks)

            end_time = time.monotonic()
            generation_time = end_time - start_time

            media_post_to_save = MediaItemModel(
                user_email=user.email,
                user_id=user.id,
                mime_type=MimeTypeEnum.AUDIO_WAV,
                model="lyria-002",
                workspace_id=request_dto.workspace_id,
                prompt=request_dto.prompt,
                original_prompt=request_dto.prompt,
                num_media=len(permanent_gcs_uris),
                generation_time=generation_time,
                gcs_uris=permanent_gcs_uris,
                status=JobStatusEnum.COMPLETED,
                negative_prompt=request_dto.negative_prompt,
            )
            self.media_repo.save(media_post_to_save)

            return MediaItemResponse(
                **media_post_to_save.model_dump(),
                presigned_urls=presigned_urls,
            )

        except Exception as e:
            logger.error(f"Audio generation API call failed: {e}")
            raise
