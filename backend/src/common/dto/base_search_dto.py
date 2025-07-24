from typing import Optional
from pydantic import BaseModel, Field

class BaseSearchDto(BaseModel):
    """
    A base DTO for paginated search queries.
    Provides common fields for limit and cursor-based pagination.
    """
    limit: int = Field(
        default=12,
        ge=1,
        le=48,
        description="Number of items to return per page."
    )

    # The cursor is the ID of the last document from the previous page.
    # It's optional because the first request will not have a cursor.
    start_after: Optional[str] = Field(
        default=None,
        description="The document ID to start the query after for pagination."
    )
