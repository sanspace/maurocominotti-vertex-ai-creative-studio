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
from typing import Any, Dict, Optional
from google.genai import types, Client
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
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
    RANDOM_PROMPT_TEMPLATE = "Generate a single, random, creative, and visually descriptive prompt suitable for an AI image generator. The prompt should be concise and evocative."

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
    def generate_text(
        self,
        prompt_template: str,
        variables: Optional[Dict[str, Any]] = None,
        model_id: Optional[str] = None
    ) -> str:
        """
        Generates text using Gemini from a template and optional variables.

        Args:
            prompt_template: The string template for the prompt.
            variables: A dictionary of variables to format into the template.
            model_id: The specific Gemini model to use. Defaults to the one in config.

        Returns:
            The generated text from the model.
        """
        final_prompt = prompt_template.format(**(variables or {}))
        target_model = model_id or self.cfg.MODEL_ID # Use default rewriter model

        logger.info(f"Sending request to Gemini model: {target_model}")
        try:
            response = self.client.models.generate_content(
                model=target_model,
                contents=final_prompt,
                config=types.GenerateContentConfig(response_modalities=["TEXT"]),
            )
            logger.info("Successfully received response from Gemini.")
            return response.text.strip() if response.text else ""
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise

    def generate_random_image_prompt(self) -> str:
        """Generates a completely new, random prompt for image creation."""
        logger.info("Generating a new random image prompt...")
        return self.generate_text(prompt_template=self.RANDOM_PROMPT_TEMPLATE)

    @staticmethod
    def rewrite_for_image(image_request_dto: CreateImagenDto) -> str:
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
        if image_request_dto.image_style:
            prompt_parts.append(f"in a {image_request_dto.image_style.lower()} style")

        # Conditionally add lighting description.
        if image_request_dto.lighting:
            prompt_parts.append(f"with {image_request_dto.lighting.lower()} lighting")

        # Conditionally add color and tone description.
        if image_request_dto.color_and_tone:
            prompt_parts.append(f"featuring {image_request_dto.color_and_tone.lower()} colors and tones")

        # Join all the available parts into a single, well-formatted string.
        # Example output: "A futuristic city, in a vintage style, with dramatic studio lighting"
        return ", ".join(prompt_parts)

    @staticmethod
    def rewrite_for_video(video_request_dto: Any) -> str:
        """
        Placeholder for future video prompt rewriting logic.
        """
        raise NotImplementedError("Video prompt rewriting is not yet implemented.")

    @staticmethod
    def rewrite_for_audio(audio_request_dto: Any) -> str:
        """
        Placeholder for future audio prompt rewriting logic.
        """
        raise NotImplementedError("Audio prompt rewriting is not yet implemented.")
