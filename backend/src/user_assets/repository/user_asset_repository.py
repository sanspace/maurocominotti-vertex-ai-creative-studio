from typing import Optional
from google.cloud import firestore
from google.cloud.firestore_v1.base_aggregation import AggregationResult
from google.cloud.firestore_v1.query_results import QueryResultsList

from src.user_assets.dto.user_asset_search_dto import UserAssetSearchDto
from src.common.base_repository import BaseRepository
from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.user_assets.schema.user_asset_model import UserAssetModel


class UserAssetRepository(BaseRepository[UserAssetModel]):
    """Handles database operations for UserAsset objects in Firestore."""

    def __init__(self):
        super().__init__(collection_name="user_assets", model=UserAssetModel)

    def find_by_hash(self, user_id: str, file_hash: str) -> Optional[UserAssetModel]:
        """Finds a user asset by its file hash to prevent duplicates."""
        query = (
            self.collection_ref.where("user_id", "==", user_id)
            .where("file_hash", "==", file_hash)
            .limit(1)
        )
        docs = list(query.stream())
        if not docs:
            return None
        return self.model.model_validate(docs[0].to_dict())

    def query(
        self, search_dto: UserAssetSearchDto, target_user_id: Optional[str] = None
    ) -> PaginationResponseDto[UserAssetModel]:
        """
        Performs a paginated query for assets. If target_user_id is provided,
        it scopes the search to that specific user.
        """
        base_query = self.collection_ref

        if search_dto.mime_type:
            base_query = base_query.where(
                "mime_type", "==", search_dto.mime_type
            )
        if target_user_id:
            base_query = base_query.where("user_id", "==", target_user_id)

        count_query = base_query.count(alias="total")
        aggregation_result = count_query.get()

        total_count = 0
        if (
            isinstance(aggregation_result, QueryResultsList)
            and aggregation_result
            and isinstance(aggregation_result[0][0], AggregationResult)  # type: ignore
        ):
            total_count = int(aggregation_result[0][0].value)  # type: ignore

        data_query = base_query.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )

        if search_dto.start_after:
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                data_query = data_query.start_after(last_doc_snapshot)

        data_query = data_query.limit(search_dto.limit)

        # Stream results and validate with the Pydantic model
        documents = list(data_query.stream())
        media_item_data = [
            self.model.model_validate(doc.to_dict()) for doc in documents
        ]

        next_page_cursor = None
        if len(documents) == search_dto.limit:
            # The cursor is the ID of the last document fetched.
            next_page_cursor = documents[-1].id

        return PaginationResponseDto[UserAssetModel](
            count=total_count,
            next_page_cursor=next_page_cursor,
            data=media_item_data,
        )
