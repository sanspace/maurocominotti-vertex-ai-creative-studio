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
import logging
import os
import pathlib
import shutil
import subprocess
import time
from typing import List
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from src.common.storage_service import GcsService
from backend.src.common.schema.genai_model_setup import GenAIModelSetup
from src.videos.schema.veo_result_model import (
    CustomVeoResult,
    VeoGenerationResult,
)
from backend.src.common.schema.media_item_model import MediaItem
from src.images.repository.media_item_repository import MediaRepository
from src.videos.dto.create_veo_dto import CreateVeoDto
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.config.config_service import ConfigService
from src.multimodal.gemini_service import GeminiService, PromptTargetEnum

logger = logging.getLogger(__name__)


class VeoService:

    def __init__(self):
        """Initializes the service with its dependencies."""
        self.iam_signer_credentials = IamSignerCredentials()
        self.media_repo = MediaRepository()
        self.gemini_service = GeminiService()
        self.gcs_service = GcsService()

    def _generate_thumbnail(self, video_path: str) -> str | None:
        """
        Generates a thumbnail from a video file using ffmpeg.

        Args:
            video_path: The path to the video file.

        Returns:
            The path to the generated thumbnail, or None if it fails.
        """
        if not video_path:
            return None

        thumbnail_filename = (
            "thumbnail_"
            + os.path.splitext(os.path.basename(video_path))[0]
            + ".png"
        )
        thumbnail_path = os.path.join(
            os.path.dirname(video_path), thumbnail_filename
        )

        command = [
            "ffmpeg",
            "-i",
            video_path,
            "-ss",
            "00:00:00.000",  # Capture frame at 0 milisecond
            "-vframes",
            "1",
            "-y",  # Overwrite output file if it exists
            thumbnail_path,
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, text=True)
            return thumbnail_path
        except FileNotFoundError:
            logger.error(
                "ffmpeg not found. Please ensure ffmpeg is installed and in your PATH."
            )
            return None
        except subprocess.CalledProcessError as e:
            logger.error(f"Error generating thumbnail: {e.stderr}")
            return None

    async def generate_videos(
        self, request_dto: CreateVeoDto, user_email: str
    ) -> list[VeoGenerationResult]:
        """
        Generates a batch of videos and saves them as a single MediaItem document.
        """
        client = GenAIModelSetup.init()
        cfg = ConfigService()
        gcs_output_directory = f"gs://{cfg.GENMEDIA_BUCKET}"

        original_prompt = request_dto.prompt
        rewritten_prompt = self.gemini_service.enhance_prompt_from_dto(
            dto=request_dto, target_type=PromptTargetEnum.VIDEO
        )
        request_dto.prompt = rewritten_prompt

        all_generated_videos: List[types.GeneratedVideo] = []

        try:
            start_time = time.monotonic()

            operation: types.GenerateVideosOperation = (
                client.models.generate_videos(
                    model="veo-3.0-generate-preview",
                    prompt=request_dto.prompt,
                    config=types.GenerateVideosConfig(
                        number_of_videos=request_dto.number_of_videos,
                        output_gcs_uri=gcs_output_directory,
                        aspect_ratio=request_dto.aspect_ratio,
                        negative_prompt=request_dto.negative_prompt,
                        generate_audio=request_dto.generate_audio,
                        duration_seconds=request_dto.duration_seconds,
                    ),
                )
            )

            # Poll the operation status until the video is ready
            while not operation.done:
                logger.info("Waiting for video generation to complete...")
                time.sleep(10)
                operation = client.operations.get(operation)

            if operation.error:
                raise Exception(operation.error)

            if (
                not operation
                or not operation.response
                or not operation.response.generated_videos
            ):
                return []

            # Download the generated video and create thumbnail
            thumbnail_path = ""

            permanent_thumbnail_gcs_uris = []
            for generated_video in operation.response.generated_videos:
                if generated_video.video and generated_video.video.uri:
                    output_path = f"{generated_video.video.uri.replace(f"gs://{cfg.GENMEDIA_BUCKET}/", "")}"

                    # Step 1: Download the Video from GCS
                    local_output_path = f"thumbnails/{output_path}"
                    downloaded_video_path = self.gcs_service.download_from_gcs(
                        gcs_uri_path=output_path,
                        destination_file_path=local_output_path,
                    )

                    # Step 2: Generate Thumbnail from the first video frame
                    thumbnail_path = self._generate_thumbnail(
                        downloaded_video_path or ""
                    )

                    # Step 3: Save the Thumbnail in GCS
                    if thumbnail_path:
                        # Get the parent directory of the thumbnail to clean it up later.
                        temp_dir = os.path.dirname(thumbnail_path)
                        try:
                            thumbnail_gcs_uri = (
                                self.gcs_service.upload_file_to_gcs(
                                    local_path=thumbnail_path,
                                    destination_blob_name=thumbnail_path.replace(
                                        "thumbnails/", ""
                                    ),
                                    mime_type="image/png",
                                )
                                or ""
                            )
                            permanent_thumbnail_gcs_uris.append(
                                thumbnail_gcs_uri
                            )
                            # TODO: Delete the folder created under thumbnails/
                        except Exception as e:
                            # It's good practice to log or handle potential upload errors.
                            print(
                                f"Failed to upload {thumbnail_path}. Error: {e}"
                            )
                        finally:
                            # This block executes whether the try block succeeded or failed.
                            # We use shutil.rmtree to recursively delete the temporary directory.
                            if os.path.exists(temp_dir):
                                shutil.rmtree(temp_dir)

            all_generated_videos.extend(
                operation.response.generated_videos or []
            )

            end_time = time.monotonic()
            generation_time = end_time - start_time

            # --- UNIFIED PROCESSING AND SAVING ---
            # Create the list of permanent GCS URIs and the response for the frontend
            rai_filtered_reason = (
                operation.response.rai_media_filtered_reasons[0]
                if operation.response.rai_media_filtered_reasons
                else ""
            )
            valid_generated_videos = [
                img
                for img in all_generated_videos
                if img.video and img.video.uri
            ]
            permanent_gcs_uris = [
                img.video.uri
                for img in valid_generated_videos
                if img.video and img.video.uri
            ]
            mime_type: str = (
                valid_generated_videos[0].video.mime_type or "video/png"
                if valid_generated_videos[0].video
                else "video/png"
            )

            # 2. Create and run tasks to generate all presigned URLs in parallel
            presigned_url_tasks = [
                asyncio.to_thread(
                    self.iam_signer_credentials.generate_presigned_url, uri
                )
                for uri in permanent_gcs_uris
            ]
            presigned_urls = await asyncio.gather(*presigned_url_tasks)

            presigned_thumbnail_url_tasks = [
                asyncio.to_thread(
                    self.iam_signer_credentials.generate_presigned_url, uri
                )
                for uri in permanent_thumbnail_gcs_uris
            ]
            all_presigned_thumbnail_urls = await asyncio.gather(
                *presigned_thumbnail_url_tasks
            )

            # Create and save a SINGLE MediaItem for the entire batch
            media_post_to_save = MediaItem(
                # Core Props
                user_email=user_email,
                mime_type=mime_type,
                model=request_dto.generation_model,
                # Common Props
                prompt=rewritten_prompt,
                original_prompt=original_prompt,
                num_media=len(permanent_gcs_uris),
                generation_time=generation_time,
                aspect_ratio=request_dto.aspect_ratio,
                gcs_uris=permanent_gcs_uris,
                # Styling props
                style=request_dto.style,
                lighting=request_dto.lighting,
                color_and_tone=request_dto.color_and_tone,
                composition=request_dto.composition,
                negative_prompt=request_dto.negative_prompt,
                # Video Specific
                duration_seconds=request_dto.duration_seconds,
                thumbnail_uris=permanent_thumbnail_gcs_uris,
            )
            self.media_repo.save(media_post_to_save)

            response_video: list[VeoGenerationResult] = []
            for gen_video, presigned_url, presigned_thumbnail_url in zip(
                valid_generated_videos,
                presigned_urls,
                all_presigned_thumbnail_urls,
            ):
                if gen_video.video:
                    response_video.append(
                        VeoGenerationResult(
                            enhanced_prompt=rewritten_prompt or "",
                            original_prompt=original_prompt or "",
                            rai_filtered_reason=rai_filtered_reason,
                            video=CustomVeoResult(
                                gcs_uri=gen_video.video.uri,
                                presigned_url=presigned_url,
                                presigned_thumbnail_url=presigned_thumbnail_url,
                                encoded_video="",
                                mime_type=gen_video.video.mime_type or "",
                            ),
                        )
                    )

            return response_video

        except Exception as e:
            logger.error(f"Image generation API call failed: {e}")
            raise Exception(e)
