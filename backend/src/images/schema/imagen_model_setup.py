
from typing import Optional

from google import genai

from src.common.schema.base_model_setup import BaseModelSetup
from src.config.config_service import ConfigService
from google.genai import Client


class ImagenModelSetup(BaseModelSetup):
    """Initializes and configures the client for Imagen models."""

    @staticmethod
    def init(model_id: Optional[str] = None) -> Client:
        """
        Returns the shared client instance. The model_id is used in the
        generation call itself, not during client initialization for Vertex.
        """
        # The model_id argument is kept for signature consistency but is not
        # needed for initializing a general Vertex AI client.
        return ImagenModelSetup.get_client()
