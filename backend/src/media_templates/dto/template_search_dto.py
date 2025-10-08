from typing import Optional, List
from pydantic import BaseModel, Field
from src.media_templates.schema.media_template_model import IndustryEnum, MimeTypeEnum

class TemplateSearchDto(BaseModel):
    """Defines the searchable and filterable fields for the template gallery."""
    # Pagination fields
    limit: int = Field(default=20, ge=1, le=100)
    start_after: Optional[str] = Field(
        default=None,
        description="The document ID to start the query after for pagination."
    )

    # Filtering fields based on MediaTemplateModel
    industry: Optional[IndustryEnum] = None
    brand: Optional[str] = None
    mime_type: Optional[MimeTypeEnum] = None
    # For tags, we'll likely search one at a time
    tag: Optional[str] = Field(
        default=None,
        description="A single tag to filter by."
    )
