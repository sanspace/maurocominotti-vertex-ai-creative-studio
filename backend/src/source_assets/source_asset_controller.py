# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile

from src.auth.auth_guard import RoleChecker, get_current_user
from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.source_assets.dto.source_asset_response_dto import \
    SourceAssetResponseDto
from src.source_assets.dto.source_asset_search_dto import SourceAssetSearchDto
from src.source_assets.source_asset_service import SourceAssetService
from src.users.user_model import User, UserRoleEnum

router = APIRouter(
    prefix="/api/source_assets",
    tags=["User Assets"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(RoleChecker(allowed_roles=[UserRoleEnum.USER, UserRoleEnum.ADMIN]))],
)

@router.post("/upload", response_model=SourceAssetResponseDto)
async def upload_source_asset(
    file: UploadFile = File(),
    current_user: User = Depends(get_current_user),
    service: SourceAssetService = Depends(),
):
    """
    Uploads a new image asset for the current user.
    Handles de-duplication and automatically upscales the image.
    Accepts multipart/form-data.
    """
    return await service.upload_asset(user=current_user, file=file)

@router.post("/search", response_model=PaginationResponseDto[SourceAssetResponseDto])
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

    if UserRoleEnum.ADMIN in current_user.roles:
        if search_dto.user_email:
            # Admin is searching for a specific user. You'll need to find the user's ID.
            # TODO: Implement this user lookup in your UserRepository
            # target_user = await asyncio.to_thread(user_repo.find_by_email, search_dto.user_email)
            # if not target_user:
            #     raise HTTPException(status.HTTP_404_NOT_FOUND, "User with that email not found.")
            # target_user_id = target_user.id
            pass # Placeholder for user lookup logic
        else:
            # Admin searches all users; target_user_id remains None.
            pass
    else:
        # For regular users, force the search to their own ID.
        target_user_id = current_user.id

    return await service.list_assets_for_user(
        search_dto=search_dto, target_user_id=target_user_id
    )
