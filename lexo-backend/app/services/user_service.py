from typing import Optional, Tuple
from sqlalchemy.orm import Session

from app.models.database import User
from app.repositories.user_repository import UserRepository
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError

logger = get_logger(__name__)


class UserService:
    
    def __init__(self, db: Session):
        self.user_repo = UserRepository(db)
        self.stats_repo = StatsRepository(db)
    
    def create_or_get_user(
        self, 
        clerk_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> User:
        try:
            user, created = self.user_repo.get_or_create(clerk_id, username, email)
            
            if created:
                self.stats_repo.create_for_user(user.id)
            
            return user
        except Exception as e:
            logger.error(f"Error creating/getting user {clerk_id}: {e}")
            raise DatabaseError(f"Failed to create/get user: {str(e)}")
    
    def get_user_by_clerk_id(self, clerk_id: str) -> Optional[User]:
        return self.user_repo.get_by_clerk_id(clerk_id)
    
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        return self.user_repo.get_by_id(user_id)
