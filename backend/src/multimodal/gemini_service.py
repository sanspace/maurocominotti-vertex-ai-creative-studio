# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may
# obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from enum import Enum
import json
import logging
from typing import Any, Type, Union
from google.genai import types, Client
from pydantic import BaseModel
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from backend.src.multimodal.dto.create_prompt_imagen_dto import (
    CreatePromptImageDto,
)
from src.videos.dto.create_veo_dto import CreateVeoDto
from backend.src.multimodal.dto.create_prompt_video_dto import (
    CreatePromptVideoDto,
)
from src.multimodal.rewriters import (
    RANDOM_IMAGE_PROMPT_TEMPLATE,
    RANDOM_VIDEO_PROMPT_TEMPLATE,
    REWRITE_IMAGE_TEXT_PROMPT_TEMPLATE,
    REWRITE_IMAGE_JSON_PROMPT_TEMPLATE,
    REWRITE_VIDEO_TEXT_PROMPT_TEMPLATE,
    REWRITE_VIDEO_JSON_PROMPT_TEMPLATE,
)
from src.images.dto.create_imagen_dto import CreateImagenDto
from src.multimodal.schema.gemini_model_setup import GeminiModelSetup
from src.config.config_service import ConfigService

logger = logging.getLogger(__name__)


class PromptTargetEnum(str, Enum):
    IMAGE = "image"
    VIDEO = "video"


class MimeTypeEnum(str, Enum):
    JSON = "application/json"
    TEXT = "text/plain"


class GeminiService:
    """
    A dedicated service for interactions with Google's Gemini models.
    Handles client initialization, prompt rewriting, and error handling.
    """

    def __init__(self):
        """Initializes the Gemini client and configuration."""
        self.client: Client = GeminiModelSetup.init()
        self.cfg = ConfigService()
        self.rewriter_model = self.cfg.GEMINI_MODEL_ID

    def _get_response_schema(self, target: PromptTargetEnum) -> Type[BaseModel]:
        """Dynamically gets the Pydantic schema based on the target type."""
        if target is PromptTargetEnum.IMAGE:
            return CreatePromptImageDto
        if target is PromptTargetEnum.VIDEO:
            return CreatePromptVideoDto
        raise ValueError(f"No response schema defined for target: {target}")

    @retry(
        wait=wait_exponential(multiplier=1, min=2, max=10),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def generate_structured_prompt(
        self,
        original_prompt: str,
        target_type: PromptTargetEnum,
        prompt_template: str,
        response_mime_type: MimeTypeEnum = MimeTypeEnum.JSON,
    ) -> str:
        """
        Rewrites a user prompt using Gemini into a structured JSON format.

        Args:
            original_prompt: The initial, unstructured prompt from the user.
            target_type: The target output type (IMAGE or VIDEO).
            prompt_template: The instruction template for the Gemini model.

        Returns:
            A dictionary parsed from Gemini's JSON response.
        """
        full_prompt = f"{prompt_template} {original_prompt}"
        response_schema = self._get_response_schema(target_type)

        try:
            logger.info(
                f"Generating structured prompt for target '{target_type.value}' with model '{self.rewriter_model}'..."
            )
            response = None
            if response_mime_type.value == MimeTypeEnum.JSON.value:
                response = self.client.models.generate_content(
                    model=self.rewriter_model,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type=response_mime_type.value,
                        response_schema=response_schema,
                    ),
                )
            elif response_mime_type.value == MimeTypeEnum.TEXT.value:
                response = self.client.models.generate_content(
                    model=self.rewriter_model,
                    contents=full_prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type=response_mime_type.value
                    ),
                )
            else:
                return ""

            return response.text or ""
        except Exception as e:
            logger.error(
                f"Failed to generate structured prompt for '{original_prompt}': {e}"
            )
            raise

    def generate_random_or_rewrite_prompt(
        self, target_type: PromptTargetEnum, original_prompt: str = ""
    ) -> str:
        """Generates a completely new, random, and creative text prompt."""
        try:
            logger.info("Generating random prompt text...")
            prompt_template = RANDOM_IMAGE_PROMPT_TEMPLATE

            if not original_prompt:
                prompt_template = (
                    RANDOM_IMAGE_PROMPT_TEMPLATE
                    if target_type.value == PromptTargetEnum.IMAGE
                    else RANDOM_VIDEO_PROMPT_TEMPLATE
                )
            else:
                prompt_template = (
                    REWRITE_IMAGE_TEXT_PROMPT_TEMPLATE
                    if target_type.value == PromptTargetEnum.IMAGE
                    else REWRITE_VIDEO_TEXT_PROMPT_TEMPLATE
                )
            response = self.generate_structured_prompt(
                original_prompt=original_prompt,
                target_type=target_type,
                prompt_template=prompt_template,
                response_mime_type=MimeTypeEnum.TEXT,
            )
            return response
        except Exception as e:
            logger.error(f"Failed to generate random prompt: {e}")
            raise

    def _convert_dto_to_string(self, dto: BaseModel) -> str:
        """
        Private helper to convert a DTO into a formatted string for prompting.
        This consolidates the repetitive logic from the original file.
        """
        # Use Pydantic's model_dump to get only user-provided fields
        fields = dto.model_dump(exclude_unset=True)
        # The main 'prompt' field is the base, others are attributes
        prompt_base = fields.pop("prompt", "")

        attributes = [prompt_base]
        for key, value in fields.items():
            if value:  # Ensure value is not None or empty
                formatted_key = key.replace("_", " ").title()
                attributes.append(f"- {formatted_key}: {value}")
        return "\n".join(filter(None, attributes))

    def enhance_prompt_from_dto(
        self,
        dto: Union[CreateImagenDto, CreateVeoDto],
        target_type: PromptTargetEnum,
        response_mime_type: MimeTypeEnum = MimeTypeEnum.JSON,
    ) -> str:
        """
        Enhances a partially filled DTO by converting it to a string,
        then asking Gemini to generate a complete, structured prompt.

        This single method replaces the four repetitive `rewrite_for_*` methods.

        Args:
            dto: The input DTO, which can be for an image or video.
            target_type: The target output type (IMAGE or VIDEO).

        Returns:
            A dictionary containing the complete, structured prompt data from Gemini.
        """
        if target_type not in [PromptTargetEnum.IMAGE, PromptTargetEnum.VIDEO]:
            raise ValueError("Invalid target_type. Must be IMAGE or VIDEO.")

        prompt_template = (
            REWRITE_IMAGE_JSON_PROMPT_TEMPLATE
            if target_type == PromptTargetEnum.IMAGE
            else REWRITE_VIDEO_JSON_PROMPT_TEMPLATE
        )
        prompt_string = self._convert_dto_to_string(dto)

        return self.generate_structured_prompt(
            original_prompt=prompt_string,
            target_type=target_type,
            prompt_template=prompt_template,
            response_mime_type=response_mime_type,
        )
