from src.users.repository.user_repository import UserRepository
from src.users.user_model import User

class UserService:
    """
    Handles the business logic for user management.
    """
    def __init__(self):
        self.repository = UserRepository()

    def create_user_if_not_exists(self, uid: str, email: str, name: str, picture: str) -> User:
        """
        Retrieves a user by their UID. If the user exists, it updates their
        last login time. If the user doesn't exist, it creates a new user
        document with the current time as the last login.
        """
        # 1. Check if the user already exists in the database.
        existing_user = self.repository.get_by_id(uid)

        if existing_user:
            return existing_user

        # 2. If the user does not exist, create a new User model instance
        #    The document ID is the Firebase UID
        new_user = User(
            id=uid,
            email=email,
            roles=["user"], # Assign a default role "user" for all new users
            name=name,
            picture=picture,
        )

        # 3. Call the repository's save() method to create the new document
        self.repository.save(new_user)

        return new_user
