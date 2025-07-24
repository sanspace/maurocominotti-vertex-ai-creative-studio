from typing import Optional
from pydantic import BaseModel

from src.galleries.dto.gallery_response_dto import GalleryItemResponse
from src.common.dto.base_search_dto import BaseSearchDto

class GallerySearchDto(BaseSearchDto):
    user_email: Optional[str] = None
    mime_type: Optional[str] = None
    model: Optional[str] = None

class PaginatedGalleryResponse(BaseModel):
    """Defines the response structure for a paginated gallery query."""
    items: list[GalleryItemResponse]
    next_page_cursor: Optional[str] = None
