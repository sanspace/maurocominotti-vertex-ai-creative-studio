from typing import  Optional

from src.common.base_schema_model import BaseSchema

class CustomVeoResult(BaseSchema):
    gcs_uri: Optional[str]
    mime_type: str
    encoded_video: str
    presigned_url: str


class VeoGenerationResult(BaseSchema):
    enhanced_prompt: str
    rai_filtered_reason: Optional[str]
    video: CustomVeoResult
