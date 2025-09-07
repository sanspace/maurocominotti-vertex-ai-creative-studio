from typing import Optional

from pydantic import Field
from src.common.base_dto import BaseDto


class ImageDataDto(BaseDto):
    gcs_uri: str = Field(
        description="Google Cloud Storage URI pointing to the image",
    )
