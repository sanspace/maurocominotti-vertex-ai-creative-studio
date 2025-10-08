from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from src.users.user_model import UserRoleEnum

class UserCreateDto(BaseModel):
    """Data Transfer Object for creating a new user."""
    email: EmailStr
    name: str = Field(..., min_length=2)
    # The role will be set to 'user' by default in the service
    # Admins can change it later via the update endpoint


class UserUpdateRoleDto(BaseModel):
    """Data Transfer Object for updating a user's role."""
    roles: List[UserRoleEnum] = Field(
        description="A list of new roles to assign to the user."
    )
