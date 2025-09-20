from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.auth.auth_guard import get_current_user
from src.brand_guidelines.brand_guideline_service import BrandGuidelineService
from src.brand_guidelines.schema.brand_guideline_model import BrandGuidelineModel
from src.users.user_model import UserModel

MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024  # 500 MB

router = APIRouter(
    prefix="/api/brand-guidelines",
    tags=["Brand Guidelines"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "",
    response_model=BrandGuidelineModel,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Brand Guideline from a PDF",
)
async def create_brand_guideline(
    name: str = Form(min_length=3, max_length=100),
    workspaceId: Optional[str] = Form(None),
    file: UploadFile = File(),
    service: BrandGuidelineService = Depends(),
    current_user: UserModel = Depends(get_current_user),
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

    # Check file size before processing
    # We seek to the end to get the size, then back to the beginning.
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File is too large. Maximum size is {MAX_UPLOAD_SIZE_BYTES // (1024*1024)}MB.",
        )

    # The service method now handles the entire synchronous workflow.
    return await service.create_and_process_guideline(
        name, file, workspaceId, current_user
    )
