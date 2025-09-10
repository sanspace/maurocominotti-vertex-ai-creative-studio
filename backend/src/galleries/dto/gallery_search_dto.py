from typing import Optional

from src.common.base_dto import BaseDto
from src.common.dto.base_search_dto import BaseSearchDto
from src.common.schema.media_item_model import JobStatusEnum
from src.galleries.dto.gallery_response_dto import MediaItemResponse


class GallerySearchDto(BaseSearchDto):
    user_email: Optional[str] = None
    mime_type: Optional[str] = None
    model: Optional[str] = None
    status: Optional[JobStatusEnum] = None
