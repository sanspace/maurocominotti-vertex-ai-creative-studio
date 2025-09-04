from typing import Annotated, Optional

from fastapi import Query
from pydantic import BaseModel, Field
from src.images.dto.image_data_dto import ImageDataDto
from src.common.base_dto import BaseDto


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
    person_image: ImageDataDto = Field(
        description="Input image of the person for try-on"
    )
    top_image: Optional[ImageDataDto] = Field(
        default=None, description="Top clothing image"
    )
    bottom_image: Optional[ImageDataDto] = Field(
        default=None, description="Bottom clothing image"
    )
    dress_image: Optional[ImageDataDto] = Field(
        default=None, description="Dress image"
    )
    shoe_image: Optional[ImageDataDto] = Field(
        default=None, description="Shoes image"
    )
