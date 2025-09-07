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

import asyncio
import hashlib
import logging
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile, status

from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.common.base_dto import GenerationModelEnum, MimeTypeEnum
from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.common.storage_service import GcsService
from src.images.dto.upscale_imagen_dto import UpscaleImagenDto
from src.images.imagen_service import ImagenService
from src.source_assets.dto.source_asset_response_dto import \
    SourceAssetResponseDto
from src.source_assets.dto.source_asset_search_dto import SourceAssetSearchDto
from src.source_assets.repository.source_asset_repository import \
    SourceAssetRepository
from src.source_assets.schema.source_asset_model import SourceAssetModel
from src.users.user_model import User

logger = logging.getLogger(__name__)

class SourceAssetService:
    """Provides business logic for managing user-uploaded assets."""

    def __init__(self):
        self.repo = SourceAssetRepository()
        self.gcs_service = GcsService()
        self.iam_signer = IamSignerCredentials()
        self.imagen_service = ImagenService() # Service to perform the upscale

    async def _create_asset_response(self, asset: SourceAssetModel) -> SourceAssetResponseDto:
        """Generates a presigned URL for the asset."""
        presigned_url = await asyncio.to_thread(
            self.iam_signer.generate_presigned_url, asset.gcs_uri
        )
        return SourceAssetResponseDto(**asset.model_dump(), presigned_url=presigned_url)

    async def upload_asset(
        self, user: User, file: UploadFile
    ) -> SourceAssetResponseDto:
        """
        Handles uploading, de-duplicating, upscaling, and saving a new user asset.
        """
        contents = await file.read()
        if not contents:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot upload an empty file.")

        file_hash = hashlib.sha256(contents).hexdigest()

        # 1. Check for duplicates for this user
        existing_asset = await asyncio.to_thread(
            self.repo.find_by_hash, user.id, file_hash
        )
        if existing_asset:
            logger.info(f"Duplicate asset found for user {user.email} with hash {file_hash[:8]}. Returning existing.")
            return await self._create_asset_response(existing_asset)

        # 2. If it's a new file, upload the original to GCS in the user's folder
        logger.info(f"New asset for user {user.email}. Uploading original file.")
        original_gcs_uri = self.gcs_service.store_to_gcs(
            folder=f"source_assets/{user.id}/originals",
            file_name=str(uuid.uuid4()),
            mime_type=file.content_type or "image/jpeg",
            contents=contents,
            decode=False,
        )

        if not original_gcs_uri:
            logger.error(f"Failed to upload original asset to GCS for user {user.email}.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not store the original asset before upscaling.",
            )

        # 3. Upscale the original image to get the best possible resolution
        logger.info(f"Upscaling original asset from {original_gcs_uri}")
        final_gcs_uri = original_gcs_uri
        try:
            upscale_dto = UpscaleImagenDto(
                user_image=original_gcs_uri,
                upscale_factor="x2",
                mime_type=MimeTypeEnum.IMAGE_PNG,
                generation_model=GenerationModelEnum.IMAGEN_3_002 # Use a model that supports upscale
            )
            upscaled_result = await self.imagen_service.upscale_image(upscale_dto)

            if not upscaled_result or not upscaled_result.image.gcs_uri:
                 raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to upscale image.")

            final_gcs_uri = upscaled_result.image.gcs_uri
            logger.info(f"Upscaling complete. Final asset at {final_gcs_uri}")

        except Exception as e:
            logger.error(f"Failed to upscale asset for user {user.email}: {e}", exc_info=True)
            # Fallback: if upscale fails, use the original URI
            final_gcs_uri = original_gcs_uri

        # 4. Create and save the new UserAsset document
        new_asset = SourceAssetModel(
            user_id=user.id,
            gcs_uri=final_gcs_uri,
            original_filename=file.filename or "untitled",
            mime_type=file.content_type or "image/jpeg",
            file_hash=file_hash,
        )
        await asyncio.to_thread(self.repo.save, new_asset)

        return await self._create_asset_response(new_asset)

    async def list_assets_for_user(
        self, search_dto: SourceAssetSearchDto, target_user_id: Optional[str] = None
    ) -> PaginationResponseDto[SourceAssetResponseDto]:
        """
        Performs a paginated search, scoped to a target_user_id if provided.
        """
        assets_query_result = await asyncio.to_thread(
            self.repo.query, search_dto, target_user_id
        )
        assets = assets_query_result.data or []

        response_tasks = [self._create_asset_response(asset) for asset in assets]
        enriched_assets = await asyncio.gather(*response_tasks)

        return PaginationResponseDto[SourceAssetResponseDto](
            count=assets_query_result.count,
            next_page_cursor=assets_query_result.next_page_cursor,
            data=enriched_assets,
        )
