from typing import  Optional

from src.common.base_dto import BaseDto


class CustomVeoResult(BaseDto):
    gcs_uri: Optional[str]
    mime_type: str
    encoded_video: str
    presigned_url: str
    presigned_thumbnail_url: str


class VeoGenerationResult(BaseDto):
    enhanced_prompt: str
    original_prompt: str
    rai_filtered_reason: Optional[str]
    video: CustomVeoResult
