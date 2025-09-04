from typing import Optional

from pydantic import Field
from src.common.base_dto import BaseDto


class ImageDataDto(BaseDto):
    b64: Optional[str] = Field(
        default=None, description="Base64-encoded image data"
    )
    gcs_uri: Optional[str] = Field(
        default=None,
        description="Google Cloud Storage URI pointing to the image",
    )
