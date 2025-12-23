from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.database import User, GameHistory
from app.repositories.user_repository import UserRepository
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError, ValidationError
from app.core.config import settings
from supabase import create_client, Client

logger = get_logger(__name__)


class UserService:
    
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.stats_repo = StatsRepository(db)
        self._supabase: Optional[Client] = None

    def _get_supabase_client(self) -> Client:
        if self._supabase is None:
            self._supabase = create_client(
                settings.supabase.url,
                settings.supabase.service_role_key
            )
        return self._supabase
    
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
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.user_repo.get_by_username(username)
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.user_repo.get_by_id(user_id)

    def update_username(self, supabase_user_id: str, username: str) -> User:
        try:
            user = self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if not user:
                raise ValidationError("User not found")

            if user.username == username:
                return user

            if self.user_repo.get_by_username(username):
                raise ValidationError(f"Username '{username}' is already taken")

            user.username = username
            return self.user_repo.update(user)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating username for {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to update username: {str(e)}")
    
    def delete_user(self, supabase_user_id: str) -> bool:
        """
        Delete user and associated data
        """
        try:
            # Get user to find user_id for stats
            user = self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if not user:
                return False
            
            # Delete game history first (foreign key constraints)
            self.db.query(GameHistory).filter(
                (GameHistory.player1_id == user.id) | (GameHistory.player2_id == user.id)
            ).delete()
            
            # Delete stats
            self.stats_repo.delete_by_user_id(user.id)
            
            # Delete user
            success = self.user_repo.delete_by_supabase_user_id(supabase_user_id)
            
            if success:
                # Delete from Supabase Auth
                try:
                    supabase = self._get_supabase_client()
                    supabase.auth.admin.delete_user(supabase_user_id)
                    logger.info(f"Deleted Supabase auth user: {supabase_user_id}")
                except Exception as auth_error:
                    logger.error(f"Failed to delete Supabase auth user {supabase_user_id}: {auth_error}")
                    # Don't fail the whole operation if auth delete fails
            
            return success
        except Exception as e:
            logger.error(f"Error deleting user {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to delete user: {str(e)}")
