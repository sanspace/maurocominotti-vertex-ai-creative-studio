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
from src.galleries.dto.gallery_response_dto import MediaItemResponse
from src.images.repository.media_item_repository import MediaRepository
from src.common.schema.media_item_model import MediaItemModel

class GalleryService:
    """
    Provides business logic for querying media items and preparing them for the gallery.
    """

    def __init__(self):
        """Initializes the service with its dependencies."""
        self.media_repo = MediaRepository()
        self.iam_signer_credentials = IamSignerCredentials()

    async def _create_gallery_response(
        self, item: MediaItemModel
    ) -> MediaItemResponse:
        """
        Helper function to convert a MediaItem into a GalleryItemResponse
        by generating presigned URLs in parallel for its GCS URIs.
        """
        all_gcs_uris = item.gcs_uris or []

        # Create a list of tasks to run the synchronous URL generation in parallel threads
        tasks = [
            asyncio.to_thread(self.iam_signer_credentials.generate_presigned_url, uri)
            for uri in all_gcs_uris if uri
        ]

        # Await all URL generation tasks to complete concurrently
        presigned_urls = await asyncio.gather(*tasks)

        thumbnail_tasks = [
            asyncio.to_thread(
                self.iam_signer_credentials.generate_presigned_url, uri
            )
            for uri in (item.thumbnail_uris or "")
            if uri
        ]
        presigned_thumbnail_urls = await asyncio.gather(*thumbnail_tasks)

        # Create the response DTO, copying all original data and adding the new URLs
        return MediaItemResponse(
            **item.model_dump(),
            presigned_urls=presigned_urls,
            presigned_thumbnail_urls=presigned_thumbnail_urls
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
