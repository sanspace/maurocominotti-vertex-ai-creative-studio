from typing import Optional, List
from pydantic import BaseModel
from src.media_templates.schema.media_template_model import IndustryEnum, GenerationParameters

class UpdateTemplateDto(BaseModel):
    """
    Defines the fields that can be updated for a MediaTemplate.
    All fields are optional.
    """
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[IndustryEnum] = None
    brand: Optional[str] = None
    tags: Optional[List[str]] = None
    gcs_uris: Optional[List[str]] = None
    thumbnail_uris: Optional[List[str]] = None
    generation_parameters: Optional[GenerationParameters] = None
