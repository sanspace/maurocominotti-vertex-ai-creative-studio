from pydantic import BaseModel
from typing import List, Optional

class TranscribeResponseDto(BaseModel):
    """
    Response DTO returned to the frontend.
    Mirrors MediaItemResponse style for images: includes persisted record id, transcription text,
    any storage URIs, and presigned URLs for download.
    """
    id: Optional[str] = None
    workspace_id: str
    user_id: str
    user_email: str
    model: str
    transcription_text: str
    gcs_uri: Optional[str] = None
    presigned_url: Optional[str] = None
    generation_time_seconds: Optional[float] = None