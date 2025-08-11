import datetime
from typing import List, Optional, Dict, Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.query_results import QueryResultsList
from google.cloud.firestore_v1.base_aggregation import AggregationResult

from src.common.dto.pagination_response_dto import PaginationResponseDto
from src.users.user_model import User
from src.common.base_repository import BaseRepository
from src.users.dto.user_search_dto import UserSearchDto


class UserRepository(BaseRepository[User]):
    """
    Handles all database operations for the User collection.
    """

    def __init__(self):
        super().__init__(collection_name="users", model=User)

    def create(self, user: User) -> User:
        """
        Creates a new user document in Firestore.

        Args:
            user: A User model instance to be saved.

        Returns:
            The created User instance, now including the database-assigned ID.
        """
        doc_ref = self.collection_ref.document()
        user.id = (
            doc_ref.id
        )  # Assign the auto-generated Firestore ID to the model

        # Convert Pydantic model to dict, excluding 'id' which is the document key
        user_data = user.model_dump(exclude={"id"})
        doc_ref.set(user_data)

        return user

    def update(
        self, user_id: str, update_data: Dict[str, Any]
    ) -> Optional[User]:
        """
        Updates an existing user document.

        Args:
            user_id: The ID of the user document to update.
            update_data: A dictionary containing the fields to update.

        Returns:
            The updated User model, or None if the user was not found.
        """
        doc_ref = self.collection_ref.document(user_id)
        if not doc_ref.get().exists:
            return None

        # Automatically update the 'updated_at' timestamp on every update
        update_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc)
        doc_ref.update(update_data)

        # Fetch the updated document to return the complete, validated model
        return self.get_by_id(user_id)

    def delete(self, user_id: str) -> bool:
        """
        Deletes a user document from Firestore.

        Args:
            user_id: The ID of the user document to delete.

        Returns:
            True if the deletion was successful, False if the user was not found.
        """
        doc_ref = self.collection_ref.document(user_id)
        if not doc_ref.get().exists:
            return False

        doc_ref.delete()
        return True

    def get_by_email(self, email: str) -> Optional[User]:
        """
        Finds a single user by their email address.

        Args:
            email: The email address to search for.

        Returns:
            The User model if found, otherwise None.
        """
        query = self.collection_ref.where(
            filter=FieldFilter("email", "==", email)
        ).limit(1)
        results = list(query.stream())

        if not results:
            return None

        return self.model.model_validate(results[0].to_dict())

    def query(self, search_dto: UserSearchDto) -> PaginationResponseDto[User]:
        """
        Performs a paginated query that includes the total document count.
        """
        # 1. Build the base query with all filters applied. This will be used for both counting and fetching.
        base_query = self.collection_ref
        if search_dto.email:
            base_query = base_query.where(
                filter=FieldFilter("email", "==", search_dto.email)
            )
        if search_dto.role:
            base_query = base_query.where(
                filter=FieldFilter(
                    "roles", "array-contains", search_dto.role.value
                )
            )

        # 2. Run the server-side aggregation query to get the total count.
        # This is built from the filtered query BEFORE pagination is applied.
        count_query = base_query.count(alias="total")
        # The .get() on an aggregation is synchronous and returns the result directly.
        aggregation_result = count_query.get()

        total_count = 0
        if (
            isinstance(aggregation_result, QueryResultsList)
            and aggregation_result  # Checks that the list is not empty
            and isinstance(aggregation_result[0][0], AggregationResult)  # type: ignore
        ):
            total_count = int(aggregation_result[0][0].value)  # type: ignore

        # 3. Now, build the full data query by adding ordering and pagination to the base query.
        data_query = base_query.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )

        if search_dto.start_after:
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                # This is the corrected pagination logic
                data_query = data_query.start_after(last_doc_snapshot)

        data_query = data_query.limit(search_dto.limit)

        # 4. Execute the data query to get the documents for the current page.
        documents = list(data_query.stream())
        user_data = [
            self.model.model_validate(doc.to_dict()) for doc in documents
        ]

        # 5. Determine the cursor for the next page.
        next_page_cursor = None
        if len(documents) == search_dto.limit:
            # The cursor is the ID of the last document fetched.
            next_page_cursor = documents[-1].id

        # 6. Return the structured paginated response.
        return PaginationResponseDto[User](
            count=total_count,
            next_page_cursor=next_page_cursor,
            data=user_data,
        )
