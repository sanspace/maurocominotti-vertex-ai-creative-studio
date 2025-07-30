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

import logging
from typing import Any
from google.genai import types, Client
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.videos.dto.create_veo_dto import CreateVeoDto
from src.multimodal.dto.create_prompt_media_dto import CreatePromptMediaDto
from src.multimodal.rewriters import (
    IMAGEN_REWRITER_PROMPT,
    RANDOM_PROMPT_TEMPLATE,
    VIDEO_REWRITER_PROMPT,
)
from src.images.dto.create_imagen_dto import CreateImagenDto
from src.multimodal.schema.gemini_model_setup import GeminiModelSetup
from src.config.config_service import ConfigService

logger = logging.getLogger(__name__)

class GeminiService:
    """
    A dedicated service for all interactions with Google's Gemini models.
    Handles client initialization, API calls, and error handling.
    """
    def __init__(self):
        """Initializes the Gemini client and configuration."""
        self.client: Client = GeminiModelSetup.init()
        self.cfg = ConfigService()

    @retry(
        wait=wait_exponential(multiplier=1, min=1, max=10),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type(Exception),
        reraise=True,
    )
    def rewrite_prompt_with_gemini(
        self,
        original_prompt: str,
        prompt_template: str = IMAGEN_REWRITER_PROMPT,
        response_mime_type: str = "application/json",
        generation_model: str = "gemini-2.5-flash",
    ) -> str:
        """
        Outputs a rewritten prompt using the Gemini model.
        Args:
            original_prompt (str): The user's original prompt.
        Returns:
            str: The rewritten prompt.
        Raises:
            Exception: If the rewriter service fails.
        """
        try:
            full_prompt = f"{prompt_template} {original_prompt}"
            response = self.client.models.generate_content(
                model=generation_model,
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type=response_mime_type,
                    response_schema=CreatePromptMediaDto,
                ),
            )
            rewritten_text = response.text or ""
            return rewritten_text
        except Exception as e:
            print(f"Gemini rewriter failed: {e}")
            raise

    def generate_random_image_prompt(self) -> str:
        """Generates a completely new, random prompt for image creation."""
        return self.rewrite_prompt_with_gemini(RANDOM_PROMPT_TEMPLATE)

    def rewrite_for_image(self, image_request_dto: CreateImagenDto) -> str:
        """
        Constructs a high-quality, natural language prompt for image generation.

        This method dynamically builds a prompt from the DTO's parameters,
        gracefully handling any optional fields that are not provided.

        Args:
            image_request_dto: The DTO containing the user's request parameters.

        Returns:
            A single, cohesive string prompt ready for the image model.
        """
        # Start with the core user prompt, which is mandatory.
        prompt_parts = [image_request_dto.prompt.strip()]

        # Conditionally add style modifiers to the prompt.
        if image_request_dto.style:
            prompt_parts.append(f"in a {image_request_dto.style.lower()} style")

        # Conditionally add lighting description.
        if image_request_dto.lighting:
            prompt_parts.append(f"with {image_request_dto.lighting.lower()} lighting")

        # Conditionally add color and tone description.
        if image_request_dto.color_and_tone:
            prompt_parts.append(f"featuring {image_request_dto.color_and_tone.lower()} colors and tones")

        # Conditionally add composition
        if image_request_dto.composition:
            prompt_parts.append(
                f"featuring {image_request_dto.composition.lower()} composition"
            )

        # Join all the available parts into a single, well-formatted string.
        # Example output: "A futuristic city, in a vintage style, with dramatic studio lighting"
        rewritten_prompt = self.rewrite_prompt_with_gemini(
            ", ".join(prompt_parts), IMAGEN_REWRITER_PROMPT
        )
        return rewritten_prompt

    def rewrite_for_video(self, video_request_dto: CreateVeoDto) -> str:
        """
        Constructs a high-quality, natural language prompt for image generation.

        This method dynamically builds a prompt from the DTO's parameters,
        gracefully handling any optional fields that are not provided.

        Args:
            video_request_dto: The DTO containing the user's request parameters.

        Returns:
            A single, cohesive string prompt ready for the image model.
        """
        # Start with the core user prompt, which is mandatory.
        prompt_parts = [video_request_dto.prompt.strip()]

        # Conditionally add style modifiers to the prompt.
        if video_request_dto.video_style:
            prompt_parts.append(
                f"in a {video_request_dto.video_style.lower()} style"
            )

        # Conditionally add lighting description.
        if video_request_dto.lighting:
            prompt_parts.append(
                f"with {video_request_dto.lighting.lower()} lighting"
            )

        # Conditionally add color and tone description.
        if video_request_dto.color_and_tone:
            prompt_parts.append(
                f"featuring {video_request_dto.color_and_tone.lower()} colors and tones"
            )

        # Conditionally add composition
        if video_request_dto.composition:
            prompt_parts.append(
                f"featuring {video_request_dto.composition.lower()} composition"
            )

        # Join all the available parts into a single, well-formatted string.
        # Example output: "A futuristic city, in a vintage style, with dramatic studio lighting"
        rewritten_prompt = self.rewrite_prompt_with_gemini(
            ", ".join(prompt_parts), VIDEO_REWRITER_PROMPT
        )
        return rewritten_prompt

    def rewrite_for_audio(self, audio_request_dto: Any) -> str:
        """
        Placeholder for future audio prompt rewriting logic.
        """
        raise NotImplementedError("Audio prompt rewriting is not yet implemented.")
