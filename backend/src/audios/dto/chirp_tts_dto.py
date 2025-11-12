# backend/src/audios/dto/chirp_tts_dto.py

from typing import Optional
from pydantic import Field, field_validator

from src.common.base_dto import BaseDto

class ChirpTtsDto(BaseDto):
    """
    Request model for Chirp audio generation.
    
    Chirp 3 HD is Google's latest and most advanced TTS technology.
    This DTO enforces input constraints similar to CreateImagenDto.
    """

    prompt: str = Field(
        max_length=5000,
        description="Text to synthesize to speech."
    )
    workspace_id: str = Field(
        min_length=1,
        description="The ID of the workspace for this synthesis."
    )
    voice_name: str = Field(
        default="Orus",
        description="Voice name (e.g., 'Orus'). List of available voices depends on language_code."
    )
    # todo check for alternatives   
    language_code: str = Field(
        default="en-US",
        description="Language code for speech synthesis (e.g., en-US, es-ES, fr-FR)."
    )
    # todo check for alternatives
    speaking_rate: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Speaking rate multiplier (0.5x to 2.0x speed)."
    )
    
    pitch: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Pitch adjustment factor (0.5 to 2.0)."
    )
    enable_advanced_controls: bool = Field(
        default=False,
        description="Whether to enable advanced audio control options."
    )
    # todo check this
    

    @field_validator("text")
    def text_must_not_be_empty(cls, value: str) -> str:
        """Validates that text is not empty or whitespace only."""
        if not value.strip():
            raise ValueError("Text cannot be empty or whitespace only.")
        return value

    @field_validator("voice_name")
    def voice_name_must_be_valid(cls, value: str) -> str:
        """Validates voice name is not empty."""
        if not value.strip():
            raise ValueError("Voice name cannot be empty.")
        return value

    @field_validator("language_code")
    def language_code_must_be_valid(cls, value: str) -> str:
        """Validates language code format."""
        if not value.strip():
            raise ValueError("Language code cannot be empty.")
        # Can add additional language code format validation here
        return value