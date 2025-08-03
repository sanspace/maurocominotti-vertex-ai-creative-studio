import datetime
from enum import Enum
from typing import Optional, List, Dict
from pydantic import Field
from src.common.base_repository import BaseDocument
from src.common.base_schema_model import (
    AspectRatioEnum,
    StyleEnum,
    LightingEnum,
    ColorAndToneEnum,
    CompositionEnum,
)

class IndustryEnum(str, Enum):
    """Enum for categorizing templates by industry."""

    AUTOMOTIVE = "Automotive"
    CONSUMER_GOODS = "Consumer Goods"
    FASHION_AND_APPAREL = "Fashion & Apparel"
    FOOD_AND_BEVERAGE = "Food & Beverage"
    HEALTH_AND_WELLNESS = "Health & Wellness"
    LUXURY_GOODS = "Luxury Goods"
    TECHNOLOGY = "Technology"
    TRAVEL_AND_HOSPITALITY = "Travel & Hospitality"
    OTHER = "Other"

class TemplateModel(BaseDocument):
    """Represents a pre-configured, queryable template for media generation."""

    # --- Core Metadata ---
    name: str = Field(
        description="The display name of the template, e.g., 'Cinematic Rolex Watch Ad'."
    )
    description: str = Field(
        description="A brief explanation of what the template is for and its intended use case."
    )

    # --- Categorization & Filtering Fields ---
    media_type: str = Field(
        description="The primary type of media this template generates, e.g., 'image' or 'video'."
    )
    industry: IndustryEnum = Field(
        description="The target industry for this template."
    )
    brand: Optional[str] = Field(
        default=None,
        description="The specific brand this template is inspired by, e.g., 'IKEA', 'Tesla'."
    )
    tags: List[str] = Field(
        default_factory=list,
        description="A list of searchable keywords for filtering. E.g., ['futuristic', 'product-focused', 'vibrant']."
    )

    # --- UI Display Fields ---
    thumbnail_uris: Optional[str] = Field(
        description="The permanent GCS URI of the primary image to display as a thumbnail for this template."
    )
    gcs_uris: Optional[str] = Field(
        default=None,
        description="The permanent GCS URI to show on hover or click."
    )

    # --- Generation Parameters ---
    # This is the data payload the frontend will use to pre-fill the generation UI.
    prompt: Optional[str] = None
    original_prompt: Optional[str] = None
    model: Optional[str] = None
    aspect_ratio: Optional[AspectRatioEnum] = None
    style: Optional[StyleEnum] = None
    lighting: Optional[LightingEnum] = None
    color_and_tone: Optional[ColorAndToneEnum] = None
    composition: Optional[CompositionEnum] = None
    negative_prompt: Optional[str] = None
