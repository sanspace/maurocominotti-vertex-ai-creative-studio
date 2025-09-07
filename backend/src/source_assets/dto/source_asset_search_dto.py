from typing import Optional

from src.common.base_dto import BaseDto


class SourceAssetSearchDto(BaseDto):
    """
    Defines the query parameters for paginated search of user assets.
    """
    limit: int = 20
    start_after: Optional[str] = None # The document ID to start after
    mime_type: Optional[str] = None

    # This field will ONLY be used if the requester is an ADMIN
    user_email: Optional[str] = None
