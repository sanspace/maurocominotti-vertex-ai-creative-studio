from typing import List, Optional

from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.common.base_schema_model import BaseSchema

from google.genai import types

class CustomImagenResult(BaseSchema):
    gcs_uri: Optional[str]
    mime_type: str
    encoded_image: str
    presigned_url: str


class ImageGenerationResult(BaseSchema):
    enhanced_prompt: str
    rai_filtered_reason: Optional[str]
    image: CustomImagenResult
