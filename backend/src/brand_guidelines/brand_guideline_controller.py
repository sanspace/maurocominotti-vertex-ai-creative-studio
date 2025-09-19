from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.auth.auth_guard import RoleChecker
from src.brand_guidelines.brand_guideline_service import BrandGuidelineService
from src.brand_guidelines.schema.brand_guideline_model import BrandGuidelineModel
from src.users.user_model import UserRoleEnum

router = APIRouter(
    prefix="/api/brand-guidelines",
    tags=["Brand Guidelines"],
    dependencies=[Depends(RoleChecker(allowed_roles=[UserRoleEnum.ADMIN]))],
)


@router.post(
    "",
    response_model=BrandGuidelineModel,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Brand Guideline from a PDF",
)
async def create_brand_guideline(
    name: str = Form(min_length=3, max_length=100),
    workspace_id: Optional[str] = Form(None),
    file: UploadFile = File(),
    service: BrandGuidelineService = Depends(),
):
    """
    Uploads a brand guideline PDF.

    This endpoint performs the entire process synchronously:
    1. Uploads the PDF to storage.
    2. Calls a multimodal AI model to analyze the PDF and extract key information.
    3. Creates the complete brand guideline document in the database.

    The API will wait for the AI processing to finish before returning a response.
    """
    if not file.content_type == "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF.",
        )

    # The service method now handles the entire synchronous workflow.
    return await service.create_and_process_guideline(name, file, workspace_id)
