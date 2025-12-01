from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.database import User
from app.repositories.user_repository import UserRepository
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError, ValidationError

logger = get_logger(__name__)


class UserService:
    
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)
        self.stats_repo = StatsRepository(db)
    
    def create_or_get_user(
        self, 
        supabase_user_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> User:
        try:
            # Check if user exists by supabase_user_id
            user = self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if user:
                self.user_repo.update_last_login(user)
                return user

            # Check if username is taken
            if self.user_repo.get_by_username(username):
                raise ValidationError(f"Username '{username}' is already taken")

            # Check if email is taken
            if email and self.user_repo.get_by_email(email):
                raise ValidationError(f"Email '{email}' is already registered")

            # Create new user
            user = self.user_repo.create_user(supabase_user_id, username, email)
            self.stats_repo.create_for_user(user.id)
            
            return user
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error creating/getting user {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to create/get user: {str(e)}")
    
    def get_user_by_supabase_id(self, supabase_user_id: str) -> Optional[User]:
        return self.user_repo.get_by_supabase_user_id(supabase_user_id)
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.user_repo.get_by_id(user_id)
