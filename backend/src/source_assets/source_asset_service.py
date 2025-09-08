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
from src.source_assets.dto.source_asset_response_dto import (
    SourceAssetResponseDto,
)
from src.source_assets.dto.source_asset_search_dto import SourceAssetSearchDto
from src.source_assets.dto.vto_assets_response_dto import VtoAssetsResponseDto
from src.source_assets.repository.source_asset_repository import (
    SourceAssetRepository,
)
from src.source_assets.schema.source_asset_model import (
    AssetScopeEnum,
    AssetTypeEnum,
    SourceAssetModel,
)
from src.users.user_model import UserModel, UserRoleEnum

logger = logging.getLogger(__name__)


class SourceAssetService:
    """Provides business logic for managing user-uploaded assets."""

    def __init__(self):
        self.repo = SourceAssetRepository()
        self.gcs_service = GcsService()
        self.iam_signer = IamSignerCredentials()
        self.imagen_service = ImagenService()  # Service to perform the upscale

    async def _create_asset_response(
        self, asset: SourceAssetModel
    ) -> SourceAssetResponseDto:
        """Generates a presigned URL for the asset."""
        presigned_url = await asyncio.to_thread(
            self.iam_signer.generate_presigned_url, asset.gcs_uri
        )
        return SourceAssetResponseDto(
            **asset.model_dump(), presigned_url=presigned_url
        )

    async def upload_asset(
        self,
        user: UserModel,
        file: UploadFile,
        scope: Optional[AssetScopeEnum] = None,
        asset_type: Optional[AssetTypeEnum] = None,
    ) -> SourceAssetResponseDto:
        """
        Handles uploading, de-duplicating, upscaling, and saving a new user asset.
        """
        contents = await file.read()
        if not contents:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cannot upload an empty file."
            )

        file_hash = hashlib.sha256(contents).hexdigest()

        # 1. Check for duplicates for this user
        existing_asset = await asyncio.to_thread(
            self.repo.find_by_hash, user.id, file_hash
        )
        if existing_asset:
            logger.info(
                f"Duplicate asset found for user {user.email} with hash {file_hash[:8]}. Returning existing."
            )
            return await self._create_asset_response(existing_asset)

        # 2. If it's a new file, upload the original to GCS in the user's folder
        logger.info(
            f"New asset for user {user.email}. Uploading original file."
        )
        original_gcs_uri = self.gcs_service.store_to_gcs(
            folder=f"source_assets/{user.id}/originals",
            file_name=str(uuid.uuid4()),
            mime_type=file.content_type or "image/jpeg",
            contents=contents,
            decode=False,
        )

        if not original_gcs_uri:
            logger.error(
                f"Failed to upload original asset to GCS for user {user.email}."
            )
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
                generation_model=GenerationModelEnum.IMAGEN_3_002,  # Use a model that supports upscale
            )
            upscaled_result = await self.imagen_service.upscale_image(
                upscale_dto
            )

            if not upscaled_result or not upscaled_result.image.gcs_uri:
                raise HTTPException(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    "Failed to upscale image.",
                )

            final_gcs_uri = upscaled_result.image.gcs_uri
            logger.info(f"Upscaling complete. Final asset at {final_gcs_uri}")

        except Exception as e:
            logger.error(
                f"Failed to upscale asset for user {user.email}: {e}",
                exc_info=True,
            )
            # Fallback: if upscale fails, use the original URI
            final_gcs_uri = original_gcs_uri

        # 4. Create and save the new UserAsset document
        mime_type: MimeTypeEnum = (
            MimeTypeEnum.IMAGE_PNG
            if file.content_type == MimeTypeEnum.IMAGE_PNG
            else MimeTypeEnum.IMAGE_JPEG
        )

        is_admin = UserRoleEnum.ADMIN in user.roles
        final_scope = AssetScopeEnum.PRIVATE
        final_asset_type = AssetTypeEnum.GENERIC_IMAGE

        if is_admin:
            # Admins can set scope and type freely.
            final_scope = scope or AssetScopeEnum.PRIVATE
            final_asset_type = asset_type or AssetTypeEnum.GENERIC_IMAGE
        else:
            # Non-admins cannot set system-level scope.
            if scope and scope != AssetScopeEnum.PRIVATE:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only administrators can set a non-private scope.",
                )

        new_asset = SourceAssetModel(
            user_id=user.id,
            gcs_uri=final_gcs_uri,
            original_filename=file.filename or "untitled",
            mime_type=mime_type,
            file_hash=file_hash,
            scope=final_scope,
            asset_type=final_asset_type,
        )
        await asyncio.to_thread(self.repo.save, new_asset)

        return await self._create_asset_response(new_asset)

    async def delete_asset(self, asset_id: str) -> bool:
        """
        Deletes an asset from Firestore and its corresponding file from GCS.
        This is an admin-only operation.

        Returns:
            bool: True if deletion was successful, False if the asset was not found.
        """
        # 1. Get the asset document from Firestore
        asset_to_delete = await asyncio.to_thread(self.repo.get_by_id, asset_id)
        if not asset_to_delete:
            logger.warning(
                f"Attempted to delete non-existent asset with ID: {asset_id}"
            )
            return False

        # TODO: Delete file from GCS
        # 2. Delete the file from GCS. We wrap this in a try/except block
        # to ensure that even if the GCS file is already gone, we still
        # attempt to delete the database record.
        # try:
        #     logger.info(f"Deleting asset file from GCS: {asset_to_delete.gcs_uri}")
        #     self.gcs_service.delete_from_gcs(asset_to_delete.gcs_uri)
        # except Exception as e:
        #     logger.error(
        #         f"Could not delete asset from GCS at {asset_to_delete.gcs_uri}, but proceeding to delete from database. Error: {e}",
        #         exc_info=True,
        #     )

        # 3. Delete the document from Firestore
        logger.info(
            f"Deleting asset document from Firestore with ID: {asset_id}"
        )
        return await asyncio.to_thread(self.repo.delete, asset_id)

    async def list_assets_for_user(
        self,
        search_dto: SourceAssetSearchDto,
        target_user_id: Optional[str] = None,
    ) -> PaginationResponseDto[SourceAssetResponseDto]:
        """
        Performs a paginated search, scoped to a target_user_id if provided.
        """
        assets_query_result = await asyncio.to_thread(
            self.repo.query, search_dto, target_user_id
        )
        assets = assets_query_result.data or []

        response_tasks = [
            self._create_asset_response(asset) for asset in assets
        ]
        enriched_assets = await asyncio.gather(*response_tasks)

        return PaginationResponseDto[SourceAssetResponseDto](
            count=assets_query_result.count,
            next_page_cursor=assets_query_result.next_page_cursor,
            data=enriched_assets,
        )

    async def get_all_vto_assets(self) -> VtoAssetsResponseDto:
        """
        Fetches all system-level VTO assets and categorizes them.

        This is used to populate the VTO selection UI for users or admins.
        """
        vto_asset_types = [
            AssetTypeEnum.VTO_PERSON_MALE,
            AssetTypeEnum.VTO_PERSON_FEMALE,
            AssetTypeEnum.VTO_TOP,
            AssetTypeEnum.VTO_BOTTOM,
            AssetTypeEnum.VTO_DRESS,
            AssetTypeEnum.VTO_SHOE,
        ]

        # Query the repository for all assets matching the scope and types
        system_assets = await asyncio.to_thread(
            self.repo.find_by_scope_and_types,
            AssetScopeEnum.SYSTEM,
            vto_asset_types,
        )

        # Create presigned URLs for all assets in parallel
        response_tasks = [
            self._create_asset_response(asset) for asset in system_assets
        ]
        enriched_assets = await asyncio.gather(*response_tasks)

        # Categorize the assets into the response DTO
        categorized_assets = VtoAssetsResponseDto()
        asset_map = {
            AssetTypeEnum.VTO_PERSON_MALE: categorized_assets.male_models,
            AssetTypeEnum.VTO_PERSON_FEMALE: categorized_assets.female_models,
            AssetTypeEnum.VTO_TOP: categorized_assets.tops,
            AssetTypeEnum.VTO_BOTTOM: categorized_assets.bottoms,
            AssetTypeEnum.VTO_DRESS: categorized_assets.dresses,
            AssetTypeEnum.VTO_SHOE: categorized_assets.shoes,
        }

        for asset in enriched_assets:
            if asset.asset_type in asset_map:
                asset_map[asset.asset_type].append(asset)

        return categorized_assets
