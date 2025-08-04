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
import datetime
import logging
import time
from typing import List
from google.genai import types, Client
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from backend.src.common.schema.genai_model_setup import GenAIModelSetup
from src.common.base_schema_model import GenerationModelEnum
from backend.src.common.schema.media_item_model import MediaItem
from src.images.repository.media_item_repository import MediaRepository
from src.images.dto.create_imagen_dto import CreateImagenDto
from src.images.dto.edit_imagen_dto import EditImagenDto
from src.images.schema.imagen_result_model import (
    CustomImagenResult,
    ImageGenerationResult,
)
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.common.storage_service import GcsService
from src.config.config_service import ConfigService
import uuid
import base64
from google.cloud import aiplatform
from src.multimodal.gemini_service import GeminiService, PromptTargetEnum

logger = logging.getLogger(__name__)


class ImagenService:
    def __init__(self):
        """Initializes the service with its dependencies."""
        self.iam_signer_credentials = IamSignerCredentials()
        self.media_repo = MediaRepository()
        self.gemini_service = GeminiService()
        self.gcs_service = GcsService()

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
    async def generate_images(
        self, request_dto: CreateImagenDto, user_email: str
    ) -> list[ImageGenerationResult]:
        """
        Generates a batch of images and saves them as a single MediaItem document.
        """
        client = GenAIModelSetup.init()
        cfg = ConfigService()
        gcs_output_directory = f"gs://{cfg.GENMEDIA_BUCKET}"

        original_prompt = request_dto.prompt
        rewritten_prompt = self.gemini_service.enhance_prompt_from_dto(
            dto=request_dto, target_type=PromptTargetEnum.IMAGE
        )
        request_dto.prompt = rewritten_prompt

        all_generated_images: List[types.GeneratedImage] = []

        try:
            start_time = time.monotonic()

            if (
                request_dto.generation_model
                == GenerationModelEnum.IMAGEN_4_ULTRA
            ):
                # --- IMAGEN 4 ULTRA: Parallel API Calls ---
                tasks = [
                    asyncio.to_thread(
                        client.models.generate_images,
                        model=request_dto.generation_model,
                        prompt=request_dto.prompt,
                        config=types.GenerateImagesConfig(
                            number_of_images=1,
                            output_gcs_uri=gcs_output_directory,
                            aspect_ratio=request_dto.aspect_ratio,
                            negative_prompt=request_dto.negative_prompt,
                            add_watermark=request_dto.add_watermark,
                        ),
                    )
                    for _ in range(request_dto.number_of_media)
                ]
                api_responses = await asyncio.gather(*tasks)
                for response in api_responses:
                    all_generated_images.extend(response.generated_images or [])
            else:
                # --- OTHER IMAGEN MODELS: Single Batch API Call ---
                images_imagen_response = await asyncio.to_thread(
                    client.models.generate_images,
                    model=request_dto.generation_model,
                    prompt=request_dto.prompt,
                    config=types.GenerateImagesConfig(
                        number_of_images=request_dto.number_of_media,
                        output_gcs_uri=gcs_output_directory,
                        aspect_ratio=request_dto.aspect_ratio,
                        negative_prompt=request_dto.negative_prompt,
                        add_watermark=request_dto.add_watermark,
                    ),
                )
                all_generated_images = (
                    images_imagen_response.generated_images or []
                )

            if not all_generated_images:
                return []

            end_time = time.monotonic()
            generation_time = end_time - start_time

            # --- UNIFIED PROCESSING AND SAVING ---
            # Create the list of permanent GCS URIs and the response for the frontend
            valid_generated_images = [
                img
                for img in all_generated_images
                if img.image and img.image.gcs_uri
            ]
            permanent_gcs_uris = [
                img.image.gcs_uri
                for img in valid_generated_images
                if img.image and img.image.gcs_uri
            ]
            mime_type: str = (
                valid_generated_images[0].image.mime_type or "image/png"
                if valid_generated_images[0].image
                else "image/png"
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
                add_watermark=request_dto.add_watermark,
            )
            self.media_repo.save(media_post_to_save)

            response_imagen: list[ImageGenerationResult] = []
            for gen_image, presigned_url in zip(
                valid_generated_images, presigned_urls
            ):
                if gen_image.image:
                    response_imagen.append(
                        ImageGenerationResult(
                            enhanced_prompt=gen_image.enhanced_prompt or "",
                            rai_filtered_reason=gen_image.rai_filtered_reason,
                            image=CustomImagenResult(
                                gcs_uri=gen_image.image.gcs_uri,
                                presigned_url=presigned_url,
                                encoded_image="",
                                mime_type=gen_image.image.mime_type or "",
                            ),
                        )
                    )

            return response_imagen

        except Exception as e:
            logger.error(f"Image generation API call failed: {e}")
            raise

    async def _generate_with_gemini(
        self,
        client: Client,
        term: str,
        number_of_images: int,
        style: str,
    ) -> List[ImageGenerationResult]:
        response_gemini: List[ImageGenerationResult] = []
        try:
            gemini_prompt_text = f"Create an image with a style '{style}' based on this user prompt: {term}"

            for i in range(
                number_of_images
            ):  # Loop as many times as images wanted
                # Run the synchronous SDK call in a separate thread
                gemini_api_response = await asyncio.to_thread(
                    client.models.generate_content,
                    model="gemini-2.0-flash-preview-image-generation",
                    contents=gemini_prompt_text,
                    config=types.GenerateContentConfig(
                        response_modalities=["TEXT", "IMAGE"]
                    ),
                )

                for candidate in (gemini_api_response.candidates or []):
                    if candidate.content and candidate.content.parts:
                        for part in candidate.content.parts:
                            if (
                                part.inline_data is not None
                                and part.inline_data.mime_type
                                and part.inline_data.data
                                and part.inline_data.mime_type.startswith(
                                    "image/"
                                )
                            ):
                                encoded_image_bytes = base64.b64encode(
                                    part.inline_data.data
                                ).decode("utf-8")
                                generated_text_for_prompt = ""
                                for p_text in candidate.content.parts:
                                    if p_text.text is not None:
                                        generated_text_for_prompt += (
                                            p_text.text + " "
                                        )

                                finish_reason_str = (
                                    candidate.finish_reason.name
                                    if candidate.finish_reason
                                    else None
                                )
                                if (
                                    gemini_api_response.prompt_feedback
                                    and gemini_api_response.prompt_feedback.block_reason
                                ):
                                    block_reason = (
                                        gemini_api_response.prompt_feedback.block_reason
                                    )
                                    block_reason_message = (
                                        gemini_api_response.prompt_feedback.block_reason_message
                                    )
                                    finish_reason_str = (
                                        block_reason_message
                                        or (
                                            block_reason.name
                                            if block_reason
                                            else "Blocked"
                                        )
                                    )

                                response_gemini.append(
                                    ImageGenerationResult(
                                        enhanced_prompt=generated_text_for_prompt.strip()
                                        or gemini_prompt_text,
                                        rai_filtered_reason=finish_reason_str,
                                        image=CustomImagenResult(
                                            gcs_uri=None,
                                            encoded_image=encoded_image_bytes,
                                            mime_type=part.inline_data.mime_type,
                                            presigned_url="",
                                        ),
                                    )
                                )
                            elif part.text is not None:
                                logger.info(
                                    f"Gemini Text Output (not an image part): {part.text}"
                                )

            logger.info(
                f"Number of images created by Gemini: {len(response_gemini)}"
            )
            return response_gemini
        except Exception as e:
            logger.error(f"Error during Gemini generation: {e}")
            return []

    async def generate_images_from_gemini(
        self, request_dto: CreateImagenDto
    ) -> list[ImageGenerationResult]:
        client = GenAIModelSetup.init()
        gemini_coroutine = self._generate_with_gemini(
            client=client,
            term=request_dto.prompt,
            number_of_images=request_dto.number_of_media,
            style=request_dto.style,
        )
        results = await asyncio.gather(gemini_coroutine, return_exceptions=True)

        response_gemini: List[ImageGenerationResult] = []
        gemini_result_index = request_dto.number_of_media
        if gemini_result_index < len(results):
            gemini_task_result = results[gemini_result_index]
            if isinstance(gemini_task_result, Exception):
                logger.error(
                    f"Exception in Gemini generation task: {gemini_task_result}"
                )
            elif gemini_task_result is not None and isinstance(gemini_task_result, List):
                response_gemini = gemini_task_result
        else:
            logger.info(
                "Gemini task result not found in the expected position in results list."
            )
        return response_gemini

    async def generate_images_from_prompt(
        self, request_dto: CreateImagenDto, user_email: str
    ) -> list[ImageGenerationResult]:
        """
        Generates images based on the input prompt and parameters.
        Returns a list of image URIs. Does not directly modify PageState.
        """
        input_txt = ""
        full_prompt = f"{input_txt}, {request_dto.prompt}"
        request_dto.prompt = full_prompt

        return await self.generate_images(request_dto, user_email)

    def generate_image_for_vto(self, prompt: str) -> ImageGenerationResult:
        """Generates a single image and returns the image bytes."""
        client = GenAIModelSetup.init()
        response = client.models.generate_images(
            model=GenerationModelEnum.IMAGEN_4_ULTRA,
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
            ),
        )
        if response.generated_images and \
          response.generated_images[0].image and \
          response.generated_images[0].image.image_bytes:
            enhanced_prompt = response.generated_images[0].enhanced_prompt
            rai_filtered_reason = response.generated_images[0].rai_filtered_reason
            generated_image = response.generated_images[0].image
            image_bytes = response.generated_images[0].image.image_bytes
            return ImageGenerationResult(
                enhanced_prompt=enhanced_prompt or "",
                rai_filtered_reason=rai_filtered_reason,
                image=CustomImagenResult(
                    gcs_uri=generated_image.gcs_uri or "",
                    encoded_image=base64.b64encode(image_bytes).decode("utf-8"),
                    mime_type=generated_image.mime_type or "",
                    presigned_url="",
                ),
            )
        else:
            raise ValueError("Image generation failed or returned no data.")

    def recontextualize_product_in_scene(self, image_uris_list: list[str], prompt: str, sample_count: int) -> list[str]:
        """Recontextualizes a product in a scene and returns a list of GCS URIs."""
        cfg = ConfigService()
        client_options = {"api_endpoint": f"{cfg.LOCATION}-aiplatform.googleapis.com"}
        client = aiplatform.gapic.PredictionServiceClient(client_options=client_options)

        model_endpoint = f"projects/{cfg.PROJECT_ID}/locations/{cfg.LOCATION}/publishers/google/models/{cfg.MODEL_IMAGEN_PRODUCT_RECONTEXT}"

        instance = { "productImages": [] }
        for product_image_uri in image_uris_list:
            product_image = {"image": {"gcsUri": product_image_uri}}
            instance["productImages"].append(product_image)

        if prompt:
            instance["prompt"] = prompt   # type: ignore

        parameters = {"sampleCount": sample_count}

        response = client.predict(
            endpoint=model_endpoint, instances=[instance], parameters=parameters   # type: ignore
        )

        gcs_uris = []
        for prediction in response.predictions:
            if prediction.get("bytesBase64Encoded"):   # type: ignore
                encoded_mask_string = prediction["bytesBase64Encoded"]   # type: ignore
                mask_bytes = base64.b64decode(encoded_mask_string)

                gcs_uri = self.gcs_service.store_to_gcs(
                    folder="recontext_results",
                    file_name=f"recontext_result_{uuid.uuid4()}.png",
                    mime_type="image/png",
                    contents=mask_bytes,
                    decode=False,
                )
                gcs_uris.append(gcs_uri)

        return gcs_uris

    @retry(
        wait=wait_exponential(
            multiplier=1, min=1, max=10
        ),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def edit_image(
        self, request_dto: EditImagenDto
    ) -> list[ImageGenerationResult]:
        """Edits an image using the Google GenAI client."""
        client = GenAIModelSetup.init()
        cfg = ConfigService()
        gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_EDITED_SUBFOLDER}"

        raw_ref_image = types.RawReferenceImage(
            reference_id=1,
            reference_image=types.Image(
                image_bytes=request_dto.user_image,
            ),
        )

        mask_ref_image = types.MaskReferenceImage(
            reference_id=2,
            config=types.MaskReferenceConfig(
                mask_mode=request_dto.mask_mode,
                mask_dilation=0,
            ),
        )

        try:
            logger.info(
                f"models.image_models.edit_image: Requesting {request_dto.number_of_media} edited images for model {request_dto.generation_model} with output to {gcs_output_directory}"
            )
            images_imagen_response = client.models.edit_image(
                model=request_dto.generation_model,
                prompt=request_dto.prompt,
                reference_images=[raw_ref_image, mask_ref_image],  # type: ignore
                config=types.EditImageConfig(
                    edit_mode=request_dto.edit_mode,
                    number_of_images=request_dto.number_of_media,
                    include_rai_reason=True,
                    output_gcs_uri=gcs_output_directory,
                    output_mime_type="image/jpeg",
                ),
            )

            response_imagen = []
            for generated_image in (images_imagen_response.generated_images or []):
                if generated_image.image:
                    response_imagen.append(
                        ImageGenerationResult(
                            enhanced_prompt=generated_image.enhanced_prompt
                            or "",
                            rai_filtered_reason=generated_image.rai_filtered_reason,
                            image=CustomImagenResult(
                                gcs_uri=generated_image.image.gcs_uri,
                                presigned_url=self.iam_signer_credentials.generate_presigned_url(
                                    generated_image.image.gcs_uri
                                ),
                                encoded_image="",
                                mime_type=generated_image.image.mime_type or "",
                            ),
                        )
                    )

            logger.info(f"Number of images created by Imagen: {len(response_imagen)}")
            return response_imagen
        except Exception as e:
            logger.error(f"API call failed: {e}")
            raise
