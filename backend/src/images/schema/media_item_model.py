import datetime
from typing import Dict, List, Optional
from pydantic import Field
from src.common.base_schema_model import (
    AspectRatioEnum,
    ColorAndToneEnum,
    CompositionEnum,
    StyleEnum,
    LightingEnum,
)
from src.common.base_repository import BaseDocument

class MediaItem(BaseDocument):
    """Represents a single media item in the library for Firestore storage and retrieval."""

    # Indexes that shouldn't and mustn't be empty
    # created_at is an index but is autopopulated by BaseDocument
    user_email: str
    mime_type: str
    model: str

    # Common fields across media types
    prompt: Optional[str] = None
    original_prompt: Optional[str] = None
    rewritten_prompt: Optional[str] = None
    num_media: Optional[int] = None
    generation_time: Optional[float] = None
    error_message: Optional[str] = None

    # Common fields across imagen and video types
    aspect_ratio: AspectRatioEnum
    style: Optional[StyleEnum] = None
    lighting: Optional[LightingEnum] = None
    color_and_tone: Optional[ColorAndToneEnum] = None
    composition: Optional[CompositionEnum] = None
    negative_prompt: Optional[str] = None
    add_watermark: Optional[bool] = None

    # URI fields
    gcsuri: Optional[str] = None
    gcs_uris: List[str] = Field(default_factory=list)
    source_images_gcs: List[str] = Field(default_factory=list)

    # Video specific
    duration_seconds: Optional[float] = None
    thumbnail_uris: List[str] = Field(default_factory=list)
    reference_image: Optional[str] = None
    last_reference_image: Optional[str] = None
    enhanced_prompt_used: Optional[bool] = None
    comment: Optional[str] = None

    # Image specific
    modifiers: List[str] = Field(default_factory=list)
    seed: Optional[int] = None
    critique: Optional[str] = None

    # Music specific
    audio_analysis: Optional[Dict] = None

    # Debugging field
    raw_data: Optional[Dict] = Field(default_factory=dict)
