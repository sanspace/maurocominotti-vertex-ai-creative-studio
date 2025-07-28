from typing import List
from google.cloud import firestore
from src.users.user_model import User
from src.common.base_repository import BaseRepository
from src.users.dto.user_search_dto import UserSearchDto

class UserRepository(BaseRepository[User]):
    """
    Handles all database operations for the User collection.
    """
    def __init__(self):
        super().__init__(collection_name="users", model=User)

    def query(self, search_dto: UserSearchDto) -> List[User]:
        """
        Performs a generic, paginated query on the users collection.
        """
        # Start with the base query and order by creation date for consistent pagination.
        query = self.collection_ref.order_by("createdAt", direction=firestore.Query.DESCENDING)

        # Apply optional filters
        if search_dto.email:
            query = query.where("email", "==", search_dto.email)
        if search_dto.role:
            query = query.where("roles", "array-contains", search_dto.role)

        # Handle cursor-based pagination
        if search_dto.start_after:
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                query = query.start_after(last_doc_snapshot)

        query = query.limit(search_dto.limit)

        return [self.model.model_validate(doc.to_dict()) for doc in query.stream()]
