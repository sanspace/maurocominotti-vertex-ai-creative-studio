from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

from src.common.base_dto import BaseDto

# This TypeVar is used to declare the type of data the paginated response will hold.
T = TypeVar("T")


class PaginationResponseDto(BaseDto, Generic[T]):
    """
    A generic DTO for sending paginated data to the client.
    It includes the data for the current page, the total count of items,
    and a cursor to fetch the next page.
    """

    data: Optional[List[T]] = Field(
        description="The list of documents for the current page."
    )
    count: int = Field(
        description="Total number of documents matching the query."
    )
    next_page_cursor: Optional[str] = Field(
        None,
        description="The cursor for fetching the next page.",
    )
