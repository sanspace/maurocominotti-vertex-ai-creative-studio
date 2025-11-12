# backend/src/audios/dto/audio_response_dto.py

from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

class AudioResponse(BaseModel):
   """
    Response model for Chirp 3 HD Text-to-Speech synthesis.
    
    Mirrors the structure of MediaItemResponse from image generation.
    Contains synthesis results and GCS URI for audio playback.
    """

    # Identifiers
    id: str = Field(description="Unique identifier for this synthesis result.")
    workspace_id: str = Field(description="Workspace ID.")
    user_id: str = Field(description="ID of the user who requested synthesis.")
    user_email: str = Field(description="Email of the user.")

    # Input Text
    original_text: str = Field(
        description="Original input text provided by user."
    )
    synthesis_text: str = Field(
        description="Text that was actually used for synthesis (may be enhanced)."
    )

    # Audio Properties
    gcs_uri: str = Field(
        description="GCS URI where the synthesized audio file is stored."
    )
    presigned_url: str = Field(
        description="Presigned URL for downloading the audio file from GCS."
    )
    audio_format: str = Field(
        default="mp3",
        description="Audio file format (mp3, wav, ogg)."
    )

    # Synthesis Configuration
    voice_name: str = Field(description="Name of the voice used for synthesis.")
    language_code: str = Field(description="Language code used for synthesis.")
    speaking_rate: float = Field(
        description="Speaking rate multiplier used."
    )
    pitch: float = Field(
        description="Pitch adjustment factor used."
    )
    enable_advanced_controls: bool = Field(
        description="Whether advanced controls were enabled."
    )

    # Model Information
    model: str = Field(
        default="chirp-3-hd",
        description="The model used for synthesis."
    )
    status: str = Field(
        default="COMPLETED",
        description="Synthesis status."
    )

    # Performance Metrics
    synthesis_time: float = Field(
        description="Time taken to synthesize the speech in seconds."
    )

    # Metadata
    created_at: datetime = Field(
        description="ISO 8601 timestamp of synthesis creation."
    )

    class Config:
        from_attributes = True