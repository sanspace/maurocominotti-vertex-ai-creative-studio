from typing import Annotated, Literal, Optional

from fastapi import Query
from google.genai import types
from pydantic import Field, field_validator, model_validator
from src.common.base_dto import (
    AspectRatioEnum,
    BaseDto,
    ColorAndToneEnum,
    CompositionEnum,
    GenerationModelEnum,
    LightingEnum,
    StyleEnum,
)


class CreateImagenDto(BaseDto):
    """
    The refactored request model. Defaults are defined here to make the API
    contract explicit and self-documenting.
    """

    prompt: Annotated[str, Query(max_length=10000)] = Field(
        description="Prompt term to be passed to the model"
    )
    generation_model: GenerationModelEnum = Field(
        default=GenerationModelEnum.IMAGEN_4_ULTRA,
        description="Model used for image generation.",
    )
    aspect_ratio: AspectRatioEnum = Field(
        default=AspectRatioEnum.RATIO_1_1,
        description="Aspect ratio of the image.",
    )
    number_of_media: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of images to generate (between 1 and 4).",
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
    add_watermark: bool = Field(
        default=False,
        description="Whether to add a watermark to the generated image.",
    )
    upscale_factor: Literal["", "x2", "x4"] = Field(
        default="",
        description="""Factor of the upscale, either x2 or x4. If empty it will not upscale""",
    )
    source_asset_ids: Optional[Annotated[list[str], Field(max_length=2)]] = Field(
        default=None,
        description="A list of source asset IDs to be used as input for image-to-image generation.",
    )
    parent_media_item_id: Optional[str] = Field(
        default=None,
        description="If editing a previously generated media item, provide its ID to maintain lineage.",
    )

    @field_validator("prompt")
    def prompt_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Prompt cannot be empty or whitespace only")
        return value

    @field_validator("generation_model")
    def validate_imagen_generation_model(
        cls, value: GenerationModelEnum
    ) -> GenerationModelEnum:
        """Ensures that only supported generation models for imagen are used."""
        valid_video_ratios = [
            GenerationModelEnum.IMAGEGEN_002,
            GenerationModelEnum.IMAGEGEN_005,
            GenerationModelEnum.IMAGEGEN_006,
            GenerationModelEnum.IMAGEN_3_001,
            GenerationModelEnum.IMAGEN_3_002,
            GenerationModelEnum.IMAGEN_3_FAST,
            GenerationModelEnum.IMAGEN_4_ULTRA,
            GenerationModelEnum.GEMINI_2_5_FLASH_IMAGE_PREVIEW,
        ]
        if value not in valid_video_ratios:
            raise ValueError("Invalid generation model for imagen.")
        return value

    @model_validator(mode="after")
    def validate_source_assets_for_model(self) -> "CreateImagenDto":
        """
        Ensures the number of source assets is valid for the selected model.
        - Gemini Flash allows up to 2 source images.
        - For other models, only IMAGEN_3_FAST and IMAGEN_3_002 support editing with 1 source image.
        """
        if self.source_asset_ids:
            is_gemini_flash = (
                self.generation_model
                == GenerationModelEnum.GEMINI_2_5_FLASH_IMAGE_PREVIEW
            )
            if not is_gemini_flash:
                if len(self.source_asset_ids) > 1:
                    raise ValueError(
                        "Only one source asset is allowed for image editing with Imagen models."
                    )
                allowed_editing_models = [
                    GenerationModelEnum.IMAGEN_3_FAST,
                    GenerationModelEnum.IMAGEN_3_002,
                ]
                if self.generation_model not in allowed_editing_models:
                    raise ValueError(
                        f"Model '{self.generation_model.value}' does not support image editing. "
                        "Please use 'imagen-3.0-fast-generate-001' or 'imagen-3.0-generate-002' for this feature."
                    )
        return self
