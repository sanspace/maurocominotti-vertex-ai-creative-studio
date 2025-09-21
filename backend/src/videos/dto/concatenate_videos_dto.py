from typing import List, Optional

from pydantic import Field, model_validator

from src.common.base_dto import AspectRatioEnum, BaseDto


class ConcatenateVideosDto(BaseDto):
    """Data Transfer Object for a video concatenation request."""

    name: str = Field(
        min_length=1,
        description="A name for the new concatenated video.",
        default="Concatenated Video",
    )
    workspace_id: str = Field(
        min_length=1, description="The ID of the workspace for this generation."
    )
    media_item_ids: Optional[List[str]] = Field(
        default=None,
        description="An ordered list of MediaItem IDs to concatenate.",
    )
    source_asset_ids: Optional[List[str]] = Field(
        default=None,
        description="An ordered list of SourceAsset IDs to concatenate.",
    )
    aspect_ratio: AspectRatioEnum = Field(
        default=AspectRatioEnum.RATIO_16_9,
        description="Aspect ratio of the image.",
    )

    @model_validator(mode="after")
    def validate_inputs(self) -> "ConcatenateVideosDto":
        """Ensures at least two total video inputs are provided."""
        media_items_count = (
            len(self.media_item_ids) if self.media_item_ids else 0
        )
        source_assets_count = (
            len(self.source_asset_ids) if self.source_asset_ids else 0
        )
        if (media_items_count + source_assets_count) < 2:
            raise ValueError("Concatenation requires at least two video inputs.")
        return self
