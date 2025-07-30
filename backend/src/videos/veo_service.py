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
import time
from typing import List
from google.genai import types
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from src.common.schema.base_model_setup import GenAIModelSetup
from src.videos.schema.veo_result_model import (
    CustomVeoResult,
    VeoGenerationResult,
)
from src.images.schema.media_item_model import MediaItem
from src.images.repository.media_item_repository import MediaRepository
from src.videos.dto.create_veo_dto import CreateVeoDto
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.config.config_service import ConfigService
from src.multimodal.gemini_service import GeminiService

logger = logging.getLogger(__name__)


class VeoService:
    def __init__(self):
        """Initializes the service with its dependencies."""
        self.iam_signer_credentials = IamSignerCredentials()
        self.media_repo = MediaRepository()
        self.gemini_service = GeminiService()

    @retry(
        wait=wait_exponential(
            multiplier=1, min=1, max=10
        ),  # Exponential backoff (1s, 2s, 4s... up to 10s)
        stop=stop_after_attempt(3),  # Stop after 3 attempts
        retry=retry_if_exception_type(
            Exception
        ),  # Retry on all exceptions for robustness
        reraise=True,  # re-raise the last exception if all retries fail
    )
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
        rewritten_prompt = self.gemini_service.rewrite_for_video(request_dto)
        request_dto.prompt = rewritten_prompt

        all_generated_videos: List[types.GeneratedVideo] = []

        try:
            start_time = time.monotonic()

            # --- VEO 3: Parallel API Calls ---
            # tasks = [
            #     asyncio.to_thread(
            #         client.models.generate_videos,
            #         model=request_dto.generation_model,
            #         prompt=request_dto.prompt
            #     )
            #     for _ in range(request_dto.number_of_videos)
            # ]
            # api_responses = await asyncio.gather(*tasks)
            # for response in api_responses:
            #     all_generated_videos.extend(response.generated_videos or [])

            operation: types.GenerateVideosOperation = (
                client.models.generate_videos(
                    model="veo-3.0-generate-preview",
                    prompt=request_dto.prompt,
                    config=types.GenerateVideosConfig(
                        number_of_videos=request_dto.number_of_videos,
                        output_gcs_uri=gcs_output_directory,
                        aspect_ratio=request_dto.aspect_ratio,
                        negative_prompt=request_dto.negative_prompt,
                        generate_audio=True,
                    ),
                )
            )

            # Poll the operation status until the video is ready
            while not operation.done:
                print("Waiting for video generation to complete...")
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

            # Create and save a SINGLE MediaItem for the entire batch
            dto_data = request_dto.model_dump(
                exclude={"number_of_videos", "prompt"}
            )
            media_post_to_save = MediaItem(
                **dto_data,  # Unpack all other matching fields from the DTO
                mime_type=mime_type,
                user_email=user_email,
                model=request_dto.generation_model,
                generation_time=generation_time,
                prompt=rewritten_prompt,
                original_prompt=original_prompt,
                gcs_uris=permanent_gcs_uris,
                num_videos=len(permanent_gcs_uris),
                aspect_ratio=request_dto.aspect_ratio,
            )
            self.media_repo.save(media_post_to_save)

            response_video: list[VeoGenerationResult] = []
            for gen_video, presigned_url in zip(
                valid_generated_videos, presigned_urls
            ):
                if gen_video.video:
                    response_video.append(
                        VeoGenerationResult(
                            enhanced_prompt=rewritten_prompt or "",
                            rai_filtered_reason=rai_filtered_reason,
                            video=CustomVeoResult(
                                gcs_uri=gen_video.video.uri,
                                presigned_url=presigned_url,
                                encoded_video="",
                                mime_type=gen_video.video.mime_type or "",
                            ),
                        )
                    )

            return response_video

        except Exception as e:
            logger.error(f"Image generation API call failed: {e}")
            raise Exception(e)
