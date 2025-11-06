from typing import Annotated, Optional

from fastapi import Query
from pydantic import Field, field_validator

from src.common.base_dto import BaseDto


class CreateLyriaDto(BaseDto):
    """
    The refactored request model. Defaults are defined here to make the API
    contract explicit and self-documenting.
    """

    prompt: Annotated[str, Query(max_length=10000)] = Field(
        description="Prompt term to be passed to the model"
    )
    workspace_id: str = Field(
        min_length=1, description="The ID of the workspace for this generation."
    )
    negative_prompt: Optional[str] = Field(
        default=None, description="Negative prompt for the audio."
    )
    sample_count: int = Field(
        default=1,
        ge=1,
        le=4,
        description="Number of audio samples to generate (between 1 and 4).",
    )
    seed: Optional[int] = Field(
        default=None,
        description="A seed for deterministic generation. If provided, the model will attempt to produce the same audio given the same prompt and other parameters. Cannot be used with sample_count in the same request.",
    )

    @field_validator("prompt")
    def prompt_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Prompt cannot be empty or whitespace only")
        return value
