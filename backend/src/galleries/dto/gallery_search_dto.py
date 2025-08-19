from typing import Optional

from src.common.base_dto import BaseDto
from src.galleries.dto.gallery_response_dto import MediaItemResponse
from src.common.dto.base_search_dto import BaseSearchDto

class GallerySearchDto(BaseSearchDto):
    user_email: Optional[str] = None
    mime_type: Optional[str] = None
    model: Optional[str] = None
