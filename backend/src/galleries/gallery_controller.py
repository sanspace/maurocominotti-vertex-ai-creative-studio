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

from fastapi import APIRouter, Depends, HTTPException, status

from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.users.user_model import UserRoleEnum
from src.auth.auth_guard import RoleChecker
from src.galleries.dto.gallery_search_dto import GallerySearchDto
from src.galleries.dto.gallery_response_dto import GalleryItemResponse
from src.galleries.gallery_service import GalleryService


router = APIRouter(
    prefix="/api/gallery",
    tags=["Creative Studio Media Gallery"],
    responses={404: {"description": "Not found"}},
    dependencies=[
        Depends(
            RoleChecker(
                allowed_roles=[
                    UserRoleEnum.ADMIN,
                    UserRoleEnum.USER,
                ]
            )
        )
    ],
)


@router.post("", response_model=PaginationResponseDto[GalleryItemResponse])
async def search_gallery_items(
    search_dto: GallerySearchDto,
    service: GalleryService = Depends(),
):
    """
    Performs a paginated search for media items.

    Provide filters and a `start_after` cursor in the request body
    to paginate through results.
    """
    return await service.get_paginated_gallery(search_dto=search_dto)

@router.get("/item/{item_id}", response_model=GalleryItemResponse)
async def get_single_gallery_item(
    item_id: str,
    service: GalleryService = Depends(),
):
    """
    Get a single media item by its ID.
    """
    item = await service.get_media_by_id(item_id=item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media item not found",
        )
    return item
