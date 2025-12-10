from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from app.models.database import User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class UserRepository(BaseRepository[User]):
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_supabase_user_id(self, supabase_user_id: str, with_stats: bool = False) -> Optional[User]:
        """
        Get user by Supabase user ID with optional eager loading of stats
        """
        query = self.db.query(User).filter(User.supabase_user_id == supabase_user_id)
        
        if with_stats:
            query = query.options(joinedload(User.stats))
        
        user = query.first()
        
        return user
    
    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()
    
    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()
    
    def get_multiple_by_ids(self, user_ids: List[int], with_stats: bool = False) -> List[User]:
        """
        Batch fetch multiple users by IDs to avoid N+1 queries
        """
        query = self.db.query(User).filter(User.id.in_(user_ids))
        
        if with_stats:
            query = query.options(joinedload(User.stats))
        
        return query.all()
    
    def create_user(
        self, 
        supabase_user_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> User:
        user = User(
            supabase_user_id=supabase_user_id,
            username=username,
            email=email
        )
        return self.create(user)
    
    def update_last_login(self, user: User) -> User:
        user.last_login = datetime.utcnow()
        return self.update(user)
    
    def get_or_create(
        self, 
        supabase_user_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> tuple[User, bool]:
        user = self.get_by_supabase_user_id(supabase_user_id)
        
        if user:
            self.update_last_login(user)
            logger.info(f"User logged in: {username}")
            return user, False
        
        user = self.create_user(supabase_user_id, username, email)
        logger.info(f"Created new user: {username} (supabase_user_id: {supabase_user_id})")
        return user, True
    
    def delete_by_supabase_user_id(self, supabase_user_id: str) -> bool:
        """
        Delete user by Supabase user ID
        """
        user = self.get_by_supabase_user_id(supabase_user_id)
        if user:
            self.db.delete(user)
            self.db.commit()
            logger.info(f"Deleted user: {supabase_user_id}")
            return True
        return False
