import datetime
from typing import Generic, TypeVar, Optional, List
import uuid
from pydantic import BaseModel, ConfigDict, Field
from google.cloud import firestore
from src.auth import firebase_client_service
from pydantic.alias_generators import to_camel

class BaseDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
    updated_at: datetime.datetime = Field(
        default_factory=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    # Pydantic v2 configuration for this sub-model
    model_config = ConfigDict(
        use_enum_values=True,  # Allows passing enum members like StyleEnum.MODERN
        extra="forbid",  # Prevents accidental extra fields
        populate_by_name=True,
        from_attributes=True,
        alias_generator=to_camel,
    )

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
        """
        Saves a Pydantic model document to Firestore, automatically
        updating the 'updatedAt' timestamp.
        """
        # Before saving, update the timestamp.
        # This ensures it's always current on every write operation.
        item.updated_at = datetime.datetime.now(datetime.timezone.utc)

        doc_ref = self.collection_ref.document(item.id)
        # Use .model_dump() for Pydantic v2
        doc_ref.set(item.model_dump(exclude_none=True))
        return item.id
