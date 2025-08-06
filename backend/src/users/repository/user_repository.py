import datetime
from typing import List, Optional, Dict, Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

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

    def query(self, search_dto: UserSearchDto) -> List[User]:
        """
        Performs a generic, paginated query on the users collection.
        This version is corrected to match your User model.
        """
        # Start with the base query and order by creation date for consistent pagination.
        # Corrected to use 'created_at' from your BaseDocument model
        query = self.collection_ref.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )

        # Apply optional filters
        if search_dto.email:
            query = query.where(
                filter=FieldFilter("email", "==", search_dto.email)
            )
        if search_dto.role:
            # Corrected to use '==' for a single string field, not 'array-contains'
            query = query.where(
                filter=FieldFilter("roles", "==", search_dto.role.value)
            )

        # Handle cursor-based pagination
        if search_dto.start_after:
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                query = query.start_after(last_doc_snapshot)

        query = query.limit(search_dto.limit)

        return [
            self.model.model_validate(doc.to_dict()) for doc in query.stream()
        ]
