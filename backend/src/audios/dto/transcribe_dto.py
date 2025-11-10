from pydantic import BaseModel, Field
from typing import Optional

class CreateTranscribeDto(BaseModel):
    """
    DTO mirror (kept for parity with image DTOs). The actual file is sent as multipart UploadFile,
    but any additional form fields may map here if you choose to accept JSON in other flows.
    """
    workspace_id: str = Field(..., min_length=1, description="Workspace where transcription will be recorded")
    language_hint: Optional[str] = Field(default=None, description="Optional language hint for the STT model, e.g. 'en-US'")
    # Additional fields (e.g., enable_profanity_filter) can be added here.