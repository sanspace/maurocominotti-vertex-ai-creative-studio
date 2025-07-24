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
from typing import List
from google.genai import types, Client
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from src.common.base_schema_model import GenerationModelEnum
from src.images.schema.media_item_model import MediaItem
from src.images.repository.media_item_repository import MediaRepository
from src.images.dto.create_imagen_dto import CreateImagenDto
from src.images.dto.edit_imagen_dto import EditImagenDto
from src.images.schema.imagen_result_model import CustomImagenResult, ImageGenerationResult
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.images.schema.imagen_model_setup import ImagenModelSetup
from src.common.storage_service import store_to_gcs
from src.config.config_service import ConfigService
import uuid
import base64
from google.cloud import aiplatform
from src.multimodal.gemini_service import GeminiService

logger = logging.getLogger(__name__)


class ImagenService:
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
        retry=retry_if_exception_type(Exception),  # Retry on all exceptions for robustness
        reraise=True,  # re-raise the last exception if all retries fail
    )
    def generate_images(self, image_request_dto: CreateImagenDto, user_email: str = "maurocominotti@google.com") -> list[ImageGenerationResult]:
        """Imagen image generation with Google GenAI client"""

        client  = ImagenModelSetup.init(model_id=image_request_dto.generation_model)
        cfg = ConfigService() # Instantiate Default config to access IMAGE_BUCKET

        # Define a GCS path for outputting generated images
        # gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_GENERATED_SUBFOLDER}"
        gcs_output_directory = f"gs://{cfg.GENMEDIA_BUCKET}"

        original_prompt = image_request_dto.prompt
        image_request_dto.prompt = self.gemini_service.rewrite_for_image(image_request_dto)

        try:
            logger.info(f"models.image_models.generate_images: Requesting {image_request_dto.number_of_images} images for model {image_request_dto.generation_model} with output to {gcs_output_directory}")
            images_imagen_response = client.models.generate_images(
                model=image_request_dto.generation_model,
                prompt=image_request_dto.prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=image_request_dto.number_of_images,
                    include_rai_reason=True,
                    output_gcs_uri=gcs_output_directory,
                    aspect_ratio=image_request_dto.aspect_ratio,
                    negative_prompt=image_request_dto.negative_prompt,
                ),
            )

            response_imagen: list[ImageGenerationResult] = []
            for generated_image in (images_imagen_response.generated_images or []):
              if generated_image.image:
                # Capture the permanent GCS URI before creating a presigned URL
                original_gcs_uri = generated_image.image.gcs_uri or ""

                response_imagen.append(
                  ImageGenerationResult(
                      enhanced_prompt=generated_image.enhanced_prompt or "",
                      rai_filtered_reason=generated_image.rai_filtered_reason,
                      image=CustomImagenResult(
                          gcs_uri=self.iam_signer_credentials.generate_presigned_url(original_gcs_uri),
                          encoded_image="",
                          mime_type=generated_image.image.mime_type or "",
                      ),
                  )
                )

                # Create and save the MediaItem document
                try:
                    media_to_save = MediaItem(
                        # id is generated automatically by the model
                        user_email=user_email, # Assuming user_email is on your DTO
                        timestamp=datetime.datetime.now(datetime.timezone.utc),
                        prompt=generated_image.enhanced_prompt or image_request_dto.prompt,
                        original_prompt=original_prompt,
                        model=image_request_dto.generation_model,
                        mime_type=generated_image.image.mime_type,
                        gcs_uris=[original_gcs_uri], # Save the permanent URI
                        aspect=image_request_dto.aspect_ratio,
                        negative_prompt=image_request_dto.negative_prompt,
                        num_images=1 # This item represents a single image from the batch
                    )
                    self.media_repo.save(media_to_save)
                    logger.info(f"Successfully saved media item {media_to_save.id} to Firestore.")
                except Exception as db_error:
                    logger.error(f"Failed to save media item to Firestore: {db_error}")
                    # Decide if you want to fail the whole request or just log the error
                    # For now, we just log it and continue.

            logger.info(f"Number of images created by Imagen: {len(response_imagen)}")

            return response_imagen
        except Exception as e:
            logger.error(f"models.image_models.generate_images: API call failed: {e}")
            raise


    async def _generate_with_gemini(
        self,
        client: Client,
        term: str,
        number_of_images: int,
        image_style: str,
    ) -> List[ImageGenerationResult]:
        response_gemini: List[ImageGenerationResult] = []
        try:
            gemini_prompt_text = f"Create an image with a style '{image_style}' based on this user prompt: {term}"
            print(
                f"Calling Gemini model for '{term}' with style '{image_style}'"
            )

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
                              part.inline_data is not None and
                              part.inline_data.mime_type and
                              part.inline_data.data
                              and part.inline_data.mime_type.startswith("image/")
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
                                  finish_reason_str = block_reason_message or (
                                      block_reason.name
                                      if block_reason
                                      else "Blocked"
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
                                      ),
                                  )
                              )
                          elif part.text is not None:
                              print(
                                  f"Gemini Text Output (not an image part): {part.text}"
                              )

            print(f"Number of images created by Gemini: {len(response_gemini)}")
            return response_gemini
        except Exception as e:
            print(f"Error during Gemini generation: {e}")
            return []


    async def generate_images_from_gemini(self, image_request_dto: CreateImagenDto) -> list[ImageGenerationResult]:
        client  = ImagenModelSetup.init(model_id=image_request_dto.generation_model)
        gemini_coroutine = self._generate_with_gemini(
            client=client,
            term=image_request_dto.prompt,
            number_of_images=image_request_dto.number_of_images,
            image_style=image_request_dto.image_style,
        )
        results = await asyncio.gather(gemini_coroutine, return_exceptions=True)

        response_gemini: List[ImageGenerationResult] = []
        gemini_result_index = image_request_dto.number_of_images
        if gemini_result_index < len(results):
            gemini_task_result = results[gemini_result_index]
            if isinstance(gemini_task_result, Exception):
                print(
                    f"Exception in Gemini generation task: {gemini_task_result}"
                )
            elif gemini_task_result is not None and isinstance(gemini_task_result, List):
                response_gemini = gemini_task_result
        else:
            print(
                "Gemini task result not found in the expected position in results list."
            )
        return response_gemini


    def generate_images_from_prompt(self, image_request_dto: CreateImagenDto) -> list[ImageGenerationResult]:
        """
        Generates images based on the input prompt and parameters.
        Returns a list of image URIs. Does not directly modify PageState.
        """
        input_txt = ""
        full_prompt = f"{input_txt}, {image_request_dto.prompt}"
        image_request_dto.prompt = full_prompt

        return self.generate_images(image_request_dto)


    def generate_image_for_vto(self, prompt: str) -> ImageGenerationResult:
        """Generates a single image and returns the image bytes."""
        client = ImagenModelSetup.init(model_id=GenerationModelEnum.IMAGEN_4_ULTRA)
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

                gcs_uri = store_to_gcs(
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
    def edit_image(self, image_request_dto: EditImagenDto) -> list[ImageGenerationResult]:
        """Edits an image using the Google GenAI client."""
        client = ImagenModelSetup.init(model_id=image_request_dto.generation_model)
        cfg = ConfigService()
        gcs_output_directory = f"gs://{cfg.IMAGE_BUCKET}/{cfg.IMAGEN_EDITED_SUBFOLDER}"

        raw_ref_image = types.RawReferenceImage(
            reference_id=1,
            reference_image=types.Image(image_bytes=image_request_dto.user_image,)
        )

        mask_ref_image = types.MaskReferenceImage(
            reference_id=2,
            config=types.MaskReferenceConfig(
                mask_mode=image_request_dto.mask_mode,
                mask_dilation=0,
            ),
        )

        try:
            logger.info(f"models.image_models.edit_image: Requesting {image_request_dto.number_of_images} edited images for model {image_request_dto.generation_model} with output to {gcs_output_directory}")
            images_imagen_response = client.models.edit_image(
                model=image_request_dto.generation_model,
                prompt=image_request_dto.prompt,
                reference_images=[raw_ref_image, mask_ref_image],    # type: ignore
                config=types.EditImageConfig(
                    edit_mode=image_request_dto.edit_mode,
                    number_of_images=image_request_dto.number_of_images,
                    include_rai_reason=True,
                    output_gcs_uri=gcs_output_directory,
                    output_mime_type='image/jpeg',
                ),
            )

            response_imagen = []
            for generated_image in (images_imagen_response.generated_images or []):
              if generated_image.image:
                response_imagen.append(
                  ImageGenerationResult(
                      enhanced_prompt=generated_image.enhanced_prompt or "",
                      rai_filtered_reason=generated_image.rai_filtered_reason,
                      image=CustomImagenResult(
                          gcs_uri=self.iam_signer_credentials.generate_presigned_url(generated_image.image.gcs_uri),
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
