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
import time
from typing import List
from fastapi import APIRouter, HTTPException, status as Status
from pydantic import BaseModel
from fastapi import APIRouter, Depends

from src.videos.schema.veo_result_model import VeoGenerationResult
from src.videos.dto.create_veo_dto import CreateVeoDto
from src.videos.veo_service import VeoService
from src.users.user_model import User
from src.auth.auth_guard import RoleChecker, get_current_user

router = APIRouter(
    prefix="/api/videos",
    tags=["Google Video APIs"],
    responses={404: {"description": "Not found"}},
    dependencies=[
        Depends(RoleChecker(allowed_roles=["user", "creator", "admin"]))
    ],
)


@router.post("/generate-videos")
async def generate_videos(
    video_request: CreateVeoDto,
    current_user: User = Depends(get_current_user),
) -> list[VeoGenerationResult]:
    try:
        service = VeoService()
        return await service.generate_videos(
            request_dto=video_request, user_email=current_user.email
        )
    except HTTPException as http_exception:
        raise http_exception
    except ValueError as value_error:
        raise HTTPException(
            status_code=Status.HTTP_400_BAD_REQUEST,
            detail=str(value_error),
        )
    except Exception as e:
        raise HTTPException(
            status_code=Status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
