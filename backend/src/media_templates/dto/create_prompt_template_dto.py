from typing import Annotated, List, Optional

from pydantic import BaseModel, Field

from src.common.base_dto import MimeTypeEnum
from src.media_templates.schema.media_template_model import IndustryEnum


class CreatePromptTemplateDto(BaseModel):
    name: Annotated[
        str,
        Field(
            min_length=1,
            description="The display name of the template, e.g., 'Cinematic Rolex Watch Ad'.",
        ),
    ]
    description: Annotated[
        str,
        Field(
            min_length=1,
            description="A brief explanation of what the template is for and its intended use case.",
        ),
    ]

    # --- Categorization & Filtering Fields ---
    industry: Optional[IndustryEnum] = Field(
        default=None, description="The target industry for this template."
    )
    brand: Optional[str] = Field(
        default=None,
        description="The specific brand this template is inspired by, e.g., 'IKEA'.",
    )
    tags: Optional[List[str]] = Field(
        default_factory=list,
        description="A list of searchable keywords for filtering, e.g., ['futuristic', 'vibrant'].",
    )
