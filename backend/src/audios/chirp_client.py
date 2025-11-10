import logging
from typing import Optional

logger = logging.getLogger(__name__)

class ChirpClient:
    """
    Tiny adapter that encapsulates calls to the Chirp STT model.
    Replace the internals of transcribe_bytes / transcribe_gcs_uri with actual chirp SDK or HTTP calls.

    Two convenience methods are provided:
      - transcribe_bytes: pass local audio bytes
      - transcribe_gcs_uri: pass a GCS URI (if desired) and let the backend or Chirp consume that
    """

    def __init__(self, api_key: Optional[str] = None):
        # Accept an API key or other auth; fetch from config_service in the caller if needed.
        self.api_key = api_key

    def transcribe_bytes(self, audio_bytes: bytes, filename_hint: str = "") -> str:
        """
        Blocking call to transcribe the given audio bytes. If you have a synchronous SDK,
        call it here. If you have an async HTTP API, make this async accordingly.
        """
        # TODO: Replace with real Chirp client invocation.
        # Example (pseudocode):
        # response = chirp_sdk.transcribe(audio=audio_bytes, format="wav", model="chirp-large-stt")
        # return response.text
        logger.info("ChirpClient.transcribe_bytes called; this is a placeholder implementation.")
        # Placeholder fallback: return an empty string or a mock value.
        return "TRANSCRIBED_TEXT_PLACEHOLDER"

    def transcribe_gcs_uri(self, gcs_uri: str) -> str:
        """
        Optionally support passing a GCS URI to Chirp if the model accepts remote URIs.
        """
        logger.info("ChirpClient.transcribe_gcs_uri called; placeholder implementation.")
        return "TRANSCRIBED_TEXT_PLACEHOLDER_FROM_GCS"