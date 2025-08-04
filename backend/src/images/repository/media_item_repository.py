from typing import List, Optional
from google.cloud import firestore

from src.galleries.dto.gallery_search_dto import GallerySearchDto
from src.common.base_repository import BaseRepository
from src.common.schema.media_item_model import MediaItem


class MediaRepository(BaseRepository[MediaItem]):
    """Handles database operations for MediaItem objects in Firestore."""

    def __init__(self):
        # Call the parent __init__ with the collection name and Pydantic model
        super().__init__(collection_name="media_library", model=MediaItem)

    def query(self, search_dto: GallerySearchDto) -> List[MediaItem]:
        """
        Performs a generic, paginated query on the media_library collection.
        """
        # Start with the base query and order by created_at for consistent pagination
        query = self.collection_ref.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )

        # Apply optional filters
        if search_dto.user_email:
            query = query.where("user_email", "==", search_dto.user_email)
        if search_dto.mime_type:
            query = query.where("mime_type", "==", search_dto.mime_type)
        if search_dto.model:
            query = query.where("model", "==", search_dto.model)

        # Handle the cursor for pagination
        if search_dto.start_after:
            # Fetch the document snapshot for the cursor ID
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                # Start the new query after the last document from the previous page
                query = query.start_after(last_doc_snapshot)

        # Apply the limit for the page size
        query = query.limit(search_dto.limit)

        return [self.model.model_validate(doc.to_dict()) for doc in query.stream()]
