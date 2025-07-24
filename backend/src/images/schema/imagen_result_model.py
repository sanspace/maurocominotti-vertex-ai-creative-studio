
from typing import Optional

from src.common.base_schema_model import BaseSchema


class CustomImagenResult(BaseSchema):
    gcs_uri: Optional[str]
    mime_type: str
    encoded_image: str


class ImageGenerationResult(BaseSchema):
    enhanced_prompt: str
    rai_filtered_reason: Optional[str]
    image: CustomImagenResult
