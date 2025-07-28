from fastapi import APIRouter, Depends, status

from src.auth.auth_guard import get_current_user
from src.users.user_model import User

router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)

# You can still have a UserService dependency for other operations if needed.
# However, for getting the current user, the auth dependency is all you need.
@router.get("/me", response_model=User, status_code=status.HTTP_200_OK)
async def get_my_profile(
    # This is the magic. FastAPI runs get_current_user, which authenticates
    # the user and provides their UserData object here.
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves the profile for the currently authenticated user.

    The user's identity is determined from the JWT sent in the Authorization header.
    This endpoint demonstrates how the `get_current_user` dependency injects
    the user's data directly into the endpoint function.
    """
    # The 'current_user' object is the fully validated user model from your database.
    # The controller doesn't need to know about the UID; it already has the whole object.
    return current_user
