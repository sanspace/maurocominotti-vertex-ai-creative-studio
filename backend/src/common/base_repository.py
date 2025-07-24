from typing import Generic, TypeVar, Optional, List
import uuid
from pydantic import BaseModel, Field
from google.cloud import firestore
from src.auth import firebase_client_service

# Define a Pydantic model that guarantees the 'id' field exists.
class BaseDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))

# Use this new base document as the bound for your generic type.
T = TypeVar("T", bound=BaseDocument)

class BaseRepository(Generic[T]):
    """
    A generic repository for common Firestore operations.
    """
    def __init__(self, collection_name: str, model: type[T]):
        self.db: firestore.Client = firebase_client_service.firestore_db
        self.collection_ref = self.db.collection(collection_name)
        self.model = model

    def get_by_id(self, item_id: str) -> Optional[T]:
        """Retrieves a single document by its ID."""
        doc_ref = self.collection_ref.document(item_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None
        return self.model.model_validate(doc.to_dict())

    def save(self, item: T) -> str:
        """Saves a Pydantic model document to Firestore."""
        doc_ref = self.collection_ref.document(item.id)
        # Use .model_dump() for Pydantic v2
        doc_ref.set(item.model_dump(exclude_none=True))
        return item.id
