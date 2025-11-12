from pydantic import BaseModel, Field

class BaseAudioDto(BaseModel):
    """Shared fields across all audio models"""
    
    workspace_id: str = Field(
        min_length=1, 
        description="The ID of the workspace for this operation."
    )
    language_code: str = Field(
        default="en-US",
        description="Language code (e.g., en-US, es-ES, fr-FR)."
    )
    output_format: str = Field(
        default="mp3",
        description="Output audio format (mp3, wav, ogg)."
    )