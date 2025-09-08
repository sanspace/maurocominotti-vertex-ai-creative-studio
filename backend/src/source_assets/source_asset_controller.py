# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.auth.auth_guard import RoleChecker, get_current_user
from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.source_assets.dto.source_asset_response_dto import (
    SourceAssetResponseDto,
)
from src.source_assets.dto.source_asset_search_dto import SourceAssetSearchDto
from src.source_assets.source_asset_service import SourceAssetService
from src.source_assets.schema.source_asset_model import (
    AssetScopeEnum,
    AssetTypeEnum,
)
from src.source_assets.dto.vto_assets_response_dto import VtoAssetsResponseDto
from src.users.user_model import User, UserRoleEnum

router = APIRouter(
    prefix="/api/source_assets",
    tags=["User Assets"],
    responses={404: {"description": "Not found"}},
    dependencies=[
        Depends(
            RoleChecker(allowed_roles=[UserRoleEnum.USER, UserRoleEnum.ADMIN])
        )
    ],
)


@router.post("/upload", response_model=SourceAssetResponseDto)
async def upload_source_asset(
    file: UploadFile = File(),
    scope: Optional[AssetScopeEnum] = Form(None),
    asset_type: Optional[AssetTypeEnum] = Form(None),
    current_user: User = Depends(get_current_user),
    service: SourceAssetService = Depends(),
):
    """
    Uploads a new source asset. Handles de-duplication and upscaling.
    Accepts multipart/form-data.

    - **scope**: (Admin only) Set the asset's scope. Defaults to 'private'.
    - **asset_type**: (Admin only) Set the asset's type. Defaults to 'generic_image'.
    """
    return await service.upload_asset(
        user=current_user,
        file=file,
        scope=scope,
        asset_type=asset_type,
    )


@router.post(
    "/search", response_model=PaginationResponseDto[SourceAssetResponseDto]
)
async def list_source_assets(
    search_dto: SourceAssetSearchDto,
    current_user: User = Depends(get_current_user),
    service: SourceAssetService = Depends(),
    # user_repo: UserRepository = Depends(), # Add this dependency for user lookups
):
    """
    Performs a paginated search for user assets with role-based access control.
    - Regular users can only search their own assets.
    - Admins can search all assets, or filter by a specific user's email.
    """
    target_user_id: Optional[str] = None

    is_admin = UserRoleEnum.ADMIN in current_user.roles

    if not is_admin:
        # For regular users, force the search to their own ID.
        target_user_id = current_user.id
        # Clear any admin-only filters that might have been sent
        search_dto.user_email = None
        search_dto.scope = None
        search_dto.asset_type = None
        search_dto.original_filename = None
    elif search_dto.user_email:
        # Admin is searching for a specific user. You'll need to find the user's ID.
        # TODO: Implement this user lookup in your UserRepository
        # user_repo = UserRepository()
        # target_user = await asyncio.to_thread(user_repo.find_by_email, search_dto.user_email)
        # if not target_user:
        #     raise HTTPException(status.HTTP_404_NOT_FOUND, "User with that email not found.")
        # target_user_id = target_user.id
        pass  # Placeholder for user lookup logic


    return await service.list_assets_for_user(
        search_dto=search_dto, target_user_id=target_user_id
    )


@router.get("/vto-assets", response_model=VtoAssetsResponseDto)
async def get_vto_assets(
    service: SourceAssetService = Depends(),
):
    """
    Retrieves all system-level VTO assets (models, clothing) categorized by type.
    This is a public endpoint for any authenticated user to populate selection UIs.
    """
    try:
        return await service.get_all_vto_assets()
    except Exception as e:
        # Re-raise as HTTPException to be caught by FastAPI's error handling
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while fetching VTO assets: {e}",
        ) from e
