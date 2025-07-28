from typing import Optional
from src.common.dto.base_search_dto import BaseSearchDto

class UserSearchDto(BaseSearchDto):
    """
    Data Transfer Object for searching and filtering users.
    Inherits pagination fields from BaseSearchDto.
    """
    email: Optional[str] = None
    role: Optional[str] = None # To filter by a specific role
