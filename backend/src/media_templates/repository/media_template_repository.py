import datetime
from typing import List, Optional, Dict, Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from src.media_templates.schema.media_template_model import MediaTemplateModel
from src.media_templates.dto.template_search_dto import TemplateSearchDto
from src.common.base_repository import BaseRepository


class MediaTemplateRepository(BaseRepository[MediaTemplateModel]):
    """Handles all database operations for MediaTemplateModel objects in Firestore."""

    def __init__(self):
        """Initializes the repository for the 'media_template_library' collection."""
        super().__init__(collection_name="media_template_library", model=MediaTemplateModel)

    def create(self, template: MediaTemplateModel) -> MediaTemplateModel:
        """
        Creates a new template document in Firestore.

        Args:
            template: A MediaTemplateModel instance with the data to save.

        Returns:
            The created template model, including the server-assigned ID and timestamps.
        """
        # model_dump converts the Pydantic model to a dict suitable for Firestore
        doc_ref = self.collection_ref.document()
        template.id = doc_ref.id # Assign the generated ID to the model
        template_data = template.model_dump(exclude={"id"}) # Exclude ID from the data body
        doc_ref.set(template_data)
        return template

    def update(self, template_id: str, update_data: Dict[str, Any]) -> Optional[MediaTemplateModel]:
        """
        Updates an existing template document in Firestore.

        Args:
            template_id: The ID of the document to update.
            update_data: A dictionary with the fields to update.

        Returns:
            The updated template model, or None if not found.
        """
        doc_ref = self.collection_ref.document(template_id)
        if not doc_ref.get().exists:
            return None

        # Automatically add/update the 'updated_at' timestamp
        update_data["updated_at"] = datetime.datetime.now(datetime.timezone.utc)
        doc_ref.update(update_data)

        # Return the updated document by fetching it again
        return self.get_by_id(template_id)

    def delete(self, template_id: str) -> bool:
        """
        Deletes a template document from Firestore.

        Args:
            template_id: The ID of the document to delete.

        Returns:
            True if the document was deleted, False if it was not found.
        """
        doc_ref = self.collection_ref.document(template_id)
        if not doc_ref.get().exists:
            return False

        doc_ref.delete()
        return True

    def query(self, search_dto: TemplateSearchDto) -> List[MediaTemplateModel]:
        """
        Performs a powerful, paginated query on the media_template_library collection.

        Note: Firestore requires a composite index for queries that combine ordering
        with range/equality filters on different fields. You may need to create these
        in your Google Cloud console.
        """
        # Start with the base query and order by created_at for consistent pagination
        query = self.collection_ref.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        )

        # Apply optional filters based on the DTO
        if search_dto.industry:
            query = query.where(filter=FieldFilter("industry", "==", search_dto.industry.value))
        if search_dto.brand:
            query = query.where(filter=FieldFilter("brand", "==", search_dto.brand))
        if search_dto.mime_type:
            query = query.where(filter=FieldFilter("mime_type", "==", search_dto.mime_type.value))
        if search_dto.tag:
            # Use 'array-contains' for powerful searching within the 'tags' list
            query = query.where(filter=FieldFilter("tags", "array-contains", search_dto.tag))

        # Handle pagination cursor
        if search_dto.start_after:
            last_doc_snapshot = self.collection_ref.document(search_dto.start_after).get()
            if last_doc_snapshot.exists:
                query = query.start_after(last_doc_snapshot)

        # Apply the page size limit
        query = query.limit(search_dto.limit)

        # Stream results and validate with the Pydantic model
        return [self.model.model_validate(doc.to_dict()) for doc in query.stream()]
