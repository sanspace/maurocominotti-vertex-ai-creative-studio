import logging
import os
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import auth
from google.auth.transport import requests as google_auth_requests
from google.oauth2 import id_token
from src.config.config_service import ConfigService
from src.users.user_model import User, UserRoleEnum
from src.users.user_service import UserService

# Initialize the service once to be used by dependencies.
user_service = UserService()
config = ConfigService()

# This scheme will require the client to send a token in the Authorization header.
# It tells FastAPI how to find the token but doesn't validate it itself.

oauth2_scheme = (
    OAuth2PasswordBearer(tokenUrl="token")
    if os.getenv("ENVIRONMENT") != "local"
    else OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
)

logger = logging.getLogger(__name__)


def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Dependency that handles the entire authentication and user provisioning flow.

    1. Verifies the Firebase ID token.
    2. Extracts user information (uid, email).
    3. Checks if a user document exists in Firestore.
    4. If the user is new, creates their document ("Just-In-Time Provisioning").
    5. Returns a Pydantic model with the user's data.
    """
    if os.getenv("ENVIRONMENT") == "local":
        # Bypass auth for local development and return mock user
        return User(
            uid="local_user_uid",
            email="local_user@example.com",
            name="Local User",
            picture="https://example.com/picture.jpg",
            roles=[UserRoleEnum.USER, UserRoleEnum.CREATOR, UserRoleEnum.ADMIN],
            is_active=True,
            is_superuser=False,
            created_at="2023-01-01T00:00:00Z",
            updated_at="2023-01-01T00:00:00Z",
        )

    try:
        # Use the official Firebase Admin SDK to verify the token.
        # This is the most secure method.
        # decoded_token = auth.verify_id_token(token)

        # Verify the Google-issued OIDC ID token from the Authorization header.
        # The audience (aud) must be the OAuth 2.0 client ID of the IAP-protected resource.
        # This client ID must be configured as the IAP_AUDIENCE environment variable.
        IAP_AUDIENCE = config.IAP_AUDIENCE
        decoded_token = id_token.verify_oauth2_token(
            token,
            google_auth_requests.Request(),  # Use google.auth.transport.requests for fetching public keys
            audience=IAP_AUDIENCE,
        )

        email = decoded_token.get("email")
        name = decoded_token.get("name")
        picture = decoded_token.get("picture")
        token_info_hd = decoded_token.get("hd")

        if not email or token_info_hd != "google.com":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: User identity could not be confirmed from token.",
            )

        # Just-In-Time (JIT) User Provisioning:
        # Create a user profile in our database on their first API call.
        user_doc = user_service.create_user_if_not_exists(
            email=email, name=name, picture=picture
        )

        if not user_doc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create or retrieve user profile.",
            )

        return user_doc

    except auth.ExpiredIdTokenError:
        logger.error(f"[get_current_user - auth.ExpiredIdTokenError]")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
        )
    except auth.InvalidIdTokenError as e:
        logger.error(f"[get_current_user - auth.InvalidIdTokenError]: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}",
        )
    except Exception as e:
        logger.error(f"[get_current_user - Exception]: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during authentication: {e}",
        )


class RoleChecker:
    """
    Dependency that checks if the authenticated user has the required roles.
    It depends on `get_current_user` to ensure the user is authenticated first.
    """

    def __init__(self, allowed_roles: List[UserRoleEnum]):
        self.allowed_roles = allowed_roles

    def __call__(self, user: User = Depends(get_current_user)):
        """
        Checks the user's roles against the allowed roles.
        """
        is_authorized = any(role in self.allowed_roles for role in user.roles)

        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have sufficient permissions to perform this action.",
            )
