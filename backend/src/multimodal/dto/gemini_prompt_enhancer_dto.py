from enum import Enum
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from src.multimodal.gemini_service import PromptTargetEnum


class RewritePromptRequest(BaseModel):
    """Request body for the /rewrite-prompt endpoint."""
    target_type: Annotated[PromptTargetEnum, Field(
        description="The target media type to tailor the prompt for (e.g., 'image' or 'video')."
    )]
    user_prompt: Annotated[str, Field(
        description="The simple, user-provided prompt to be rewritten and enhanced.",
        min_length=5
    )]

class RandomPromptRequest(BaseModel):
    """Request body for the /random-prompt endpoint."""
    target_type: Annotated[PromptTargetEnum, Field(
        description="The target media type for which to generate a random prompt."
    )]


class RewrittenPromptResponse(BaseModel):
    rewritten_prompt: str

class RandomPromptResponse(BaseModel):
    prompt: str
