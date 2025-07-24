
from typing import Optional

from google import genai

from src.common.schema.base_model_setup import BaseModelSetup
from src.config.config_service import ConfigService
from google.genai import Client


class GeminiModelSetup(BaseModelSetup):
    """Initializes and configures the client for Gemini models."""

    @staticmethod
    def init() -> Client:
        """Returns the shared client instance."""
        return GeminiModelSetup.get_client()
