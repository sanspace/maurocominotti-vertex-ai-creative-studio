from typing import  Optional
from fastapi import Query
from pydantic import  Field, field_validator
from typing_extensions import Annotated
from src.common.base_dto import (
    BaseDto,
    ColorAndToneEnum,
    GenerationModelEnum,
    AspectRatioEnum,
    StyleEnum,
    LightingEnum,
    CompositionEnum,
)


class CreateVeoDto(BaseDto):
    """
    The refactored request model. Defaults are defined here to make the API
    contract explicit and self-documenting.
    """

    prompt: Annotated[str, Query(max_length=1500)] = Field(
        description="Prompt term to be passed to the model"
    )
    generation_model: GenerationModelEnum = Field(
        default=GenerationModelEnum.VEO_3_FAST,
        description="Model used for image generation.",
    )
    aspect_ratio: AspectRatioEnum = Field(
        default=AspectRatioEnum.RATIO_16_9,
        description="Aspect ratio of the image.",
    )
    number_of_media: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of videos to generate (between 1 and 4).",
    )
    style: StyleEnum = Field(
        default=StyleEnum.MODERN, description="Style of the image."
    )
    negative_prompt: str = Field(
        default="", description="Negative prompt for the image."
    )
    color_and_tone: Optional[ColorAndToneEnum] = Field(
        default=None,
        description="The desired color and tone style for the image.",
    )
    lighting: Optional[LightingEnum] = Field(
        default=None, description="The desired lighting style for the image."
    )
    composition: Optional[CompositionEnum] = Field(
        default=None, description="The desired lighting style for the image."
    )
    generate_audio: bool = Field(
        default=False,
        description="Whether to add audio to the generated video.",
    )
    duration_seconds: int = Field(
        default=1,
        ge=1,
        le=8,
        description="Duration in seconds for the videos to generate (between 1 and 8 secs).",
    )

    @field_validator("prompt")
    def prompt_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Prompt cannot be empty or whitespace only")
        return value

    @field_validator("aspect_ratio")
    def validate_video_aspect_ratio(
        cls, value: AspectRatioEnum
    ) -> AspectRatioEnum:
        """Ensures that only supported aspect ratios for video are used."""
        valid_video_ratios = [
            AspectRatioEnum.RATIO_16_9,
            AspectRatioEnum.RATIO_9_16,
        ]
        if value not in valid_video_ratios:
            raise ValueError(
                "Invalid aspect ratio for video. Only '16:9' and '9:16' are supported."
            )
        return value

    @field_validator("generation_model")
    def validate_video_generation_model(
        cls, value: GenerationModelEnum
    ) -> GenerationModelEnum:
        """Ensures that only supported generation models for video are used."""
        valid_video_ratios = [
            GenerationModelEnum.VEO_3_FAST,
            GenerationModelEnum.VEO_3_QUALITY,
            GenerationModelEnum.VEO_2_FAST,
            GenerationModelEnum.VEO_2_QUALITY,
        ]
        if value not in valid_video_ratios:
            raise ValueError("Invalid generation model for video.")
        return value
