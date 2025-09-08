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
from typing import Optional

from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.galleries.dto.gallery_search_dto import GallerySearchDto
from src.auth.iam_signer_credentials_service import IamSignerCredentials
from src.galleries.dto.gallery_response_dto import (
    MediaItemResponse,
    SourceAssetLinkResponse,
)
from src.images.repository.media_item_repository import MediaRepository
from src.common.schema.media_item_model import MediaItemModel, SourceAssetLink
from src.source_assets.repository.source_asset_repository import (
    SourceAssetRepository,
)

class GalleryService:
    """
    Provides business logic for querying media items and preparing them for the gallery.
    """

    def __init__(self):
        """Initializes the service with its dependencies."""
        self.media_repo = MediaRepository()
        self.iam_signer_credentials = IamSignerCredentials()
        self.source_asset_repo = SourceAssetRepository()

    async def _enrich_source_asset_link(
        self, link: SourceAssetLink
    ) -> Optional[SourceAssetLinkResponse]:
        """
        Fetches the source asset document and generates a presigned URL for it.
        """
        asset_doc = await asyncio.to_thread(
            self.source_asset_repo.get_by_id, link.asset_id
        )
        if not asset_doc:
            return None

        presigned_url = await asyncio.to_thread(
            self.iam_signer_credentials.generate_presigned_url, asset_doc.gcs_uri
        )

        return SourceAssetLinkResponse(
            **link.model_dump(), presigned_url=presigned_url, gcs_uri=asset_doc.gcs_uri
        )

    async def _create_gallery_response(
        self, item: MediaItemModel
    ) -> MediaItemResponse:
        """
        Helper function to convert a MediaItem into a GalleryItemResponse
        by generating presigned URLs in parallel for its GCS URIs.
        """
        all_gcs_uris = item.gcs_uris or []

        # 1. Create tasks for main media URLs
        main_url_tasks = [
            asyncio.to_thread(self.iam_signer_credentials.generate_presigned_url, uri)
            for uri in all_gcs_uris if uri
        ]

        # 2. Create tasks for thumbnail URLs
        thumbnail_tasks = [
            asyncio.to_thread(
                self.iam_signer_credentials.generate_presigned_url, uri
            )
            for uri in (item.thumbnail_uris or "")
            if uri
        ]

        # 3. Create tasks for source asset URLs
        source_asset_tasks = []
        if item.source_assets:
            source_asset_tasks = [
                self._enrich_source_asset_link(link) for link in item.source_assets
            ]

        # 4. Gather all results concurrently
        (
            presigned_urls,
            presigned_thumbnail_urls,
            enriched_source_assets_with_nones,
        ) = await asyncio.gather(
            asyncio.gather(*main_url_tasks),
            asyncio.gather(*thumbnail_tasks),
            asyncio.gather(*source_asset_tasks),
        )

        enriched_source_assets = [asset for asset in enriched_source_assets_with_nones if asset]

        # Create the response DTO, copying all original data and adding the new URLs
        return MediaItemResponse(
            **item.model_dump(exclude={"source_assets"}),
            presigned_urls=presigned_urls,
            presigned_thumbnail_urls=presigned_thumbnail_urls,
            enriched_source_assets=enriched_source_assets or None,
        )

    async def get_paginated_gallery(
        self, search_dto: GallerySearchDto
    ) -> PaginationResponseDto[MediaItemResponse]:
        """
        Performs a paginated and filtered search for media items.
        """
        # Run the synchronous database query in a separate thread
        media_items_query = await asyncio.to_thread(
            self.media_repo.query, search_dto
        )
        media_items = media_items_query.data or []

        # Convert each MediaItem to a GalleryItemResponse in parallel
        response_tasks = [self._create_gallery_response(item) for item in media_items]
        enriched_items = await asyncio.gather(*response_tasks)

        return PaginationResponseDto[MediaItemResponse](
            count=media_items_query.count,
            next_page_cursor=media_items_query.next_page_cursor,
            data=enriched_items,
        )

    async def get_media_by_id(
        self, item_id: str
    ) -> Optional[MediaItemResponse]:
        """
        Retrieves a single media item and enriches it with presigned URLs.
        """
        # Run the synchronous database query in a separate thread
        item = await asyncio.to_thread(self.media_repo.get_by_id, item_id)

        if not item:
            return None

        return await self._create_gallery_response(item)
