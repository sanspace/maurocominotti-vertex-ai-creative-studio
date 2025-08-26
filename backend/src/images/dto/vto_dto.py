from typing import Annotated, Optional

from fastapi import Query
from pydantic import BaseModel, Field
from src.common.base_dto import BaseDto


class ImageData(BaseModel):
    b64: Optional[str] = Field(
        default=None, description="Base64-encoded image data"
    )
    gcs_uri: Optional[str] = Field(
        default=None,
        description="Google Cloud Storage URI pointing to the image",
    )


class VtoDto(BaseDto):
    """
    VTO Dto is the request schema for Virtual Try-On image generation.
    Prompt is provided as a query parameter; all other fields go in the body.
    """

    # Body fields
    number_of_media: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of images to generate (between 1 and 4).",
    )
    person_image: ImageData = Field(
        description="Input image of the person for try-on"
    )
    top_image: Optional[ImageData] = Field(
        default=None, description="Top clothing image"
    )
    bottom_image: Optional[ImageData] = Field(
        default=None, description="Bottom clothing image"
    )
    dress_image: Optional[ImageData] = Field(
        default=None, description="Dress image"
    )
    shoe_image: Optional[ImageData] = Field(
        default=None, description="Shoes image"
    )
