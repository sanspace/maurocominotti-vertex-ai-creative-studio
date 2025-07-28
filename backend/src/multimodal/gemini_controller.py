# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may
# obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

# Import the service and the necessary DTO for the request body
from src.auth.auth_guard import RoleChecker
from src.multimodal.gemini_service import GeminiService
from src.images.dto.create_imagen_dto import CreateImagenDto
from fastapi import APIRouter, Depends

# Define simple Pydantic models for structured JSON responses
class RewrittenPromptResponse(BaseModel):
    rewritten_prompt: str

class RandomPromptResponse(BaseModel):
    prompt: str


# Create a new router for Gemini-related utility endpoints
router = APIRouter(
    prefix="/api/gemini",
    tags=["Gemini APIs"],
    responses={404: {"description": "Not found"}},
    dependencies=[
        Depends(RoleChecker(allowed_roles=["user", "creator", "admin"]))
    ],
)


@router.post(
    "/rewrite-image-prompt",
    response_model=RewrittenPromptResponse,
    summary="Rewrite and enhance a prompt for image generation"
)
async def rewrite_image_prompt_endpoint(
    image_request: CreateImagenDto,
):
    """
    Takes a set of image generation parameters and combines them into a single,
    high-quality, natural language prompt suitable for an image model.
    This uses a deterministic, rule-based approach.
    """
    try:
        # Since rewrite_for_image is a static method, we can call it directly
        # on the class without needing to instantiate the service.
        rewritten_prompt = GeminiService.rewrite_for_image(image_request)
        return RewrittenPromptResponse(rewritten_prompt=rewritten_prompt)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during prompt rewriting: {e}"
        )


@router.get(
    "/random-image-prompt",
    response_model=RandomPromptResponse,
    summary="Generate a random, creative prompt for image creation"
)
async def random_image_prompt_endpoint(
    gemini_service: GeminiService = Depends(),
):
    """
    Generates a completely new, random, and visually descriptive prompt using Gemini.
    Useful for sparking creativity or for a "surprise me" feature.
    """
    try:
        # This method requires an instance of the service to make an API call.
        # FastAPI's Depends() handles the instantiation for us.
        random_prompt = gemini_service.generate_random_image_prompt()
        return RandomPromptResponse(prompt=random_prompt)
    except Exception as e:
        # This endpoint makes a network call, so error handling is critical.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate random prompt from Gemini: {e}"
        )
