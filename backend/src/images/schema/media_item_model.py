
import datetime
from typing import Dict, List, Optional
import uuid
from pydantic import Field
from src.common.base_repository import BaseDocument

class MediaItem(BaseDocument):
    """Represents a single media item in the library for Firestore storage and retrieval."""

    user_email: Optional[str] = None
    timestamp: Optional[datetime.datetime] = None

    # Common fields across media types
    prompt: Optional[str] = None
    original_prompt: Optional[str] = None
    rewritten_prompt: Optional[str] = None
    model: Optional[str] = None
    mime_type: Optional[str] = None
    generation_time: Optional[float] = None
    error_message: Optional[str] = None

    # URI fields
    gcsuri: Optional[str] = None
    gcs_uris: List[str] = Field(default_factory=list) # ✅ Use default_factory for lists
    source_images_gcs: List[str] = Field(default_factory=list)

    # Video specific
    aspect: Optional[str] = None
    duration: Optional[float] = None
    reference_image: Optional[str] = None
    last_reference_image: Optional[str] = None
    enhanced_prompt_used: Optional[bool] = None
    comment: Optional[str] = None

    # Image specific
    modifiers: List[str] = Field(default_factory=list)
    negative_prompt: Optional[str] = None
    num_images: Optional[int] = None
    seed: Optional[int] = None
    critique: Optional[str] = None

    # Music specific
    audio_analysis: Optional[Dict] = None

    # Debugging field
    raw_data: Optional[Dict] = Field(default_factory=dict)
