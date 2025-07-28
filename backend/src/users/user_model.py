from typing import List
from pydantic import Field

from src.common.base_repository import BaseDocument

class User(BaseDocument):
    """
    Represents a user document in the Firestore database.
    The document ID for this model should be the Firebase Auth UID.
    """
    email: str
    roles: List[str] = Field(default_factory=list)
    name: str
    picture: str

