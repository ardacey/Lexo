from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from datetime import datetime

from app.models.database import User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger
from app.core.cache import cache

logger = get_logger(__name__)


class UserRepository(BaseRepository[User]):
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_clerk_id(self, clerk_id: str, with_stats: bool = False) -> Optional[User]:
        """
        Get user by Clerk ID with optional eager loading of stats
        """
        # Try cache first
        cache_key = f"user:clerk:{clerk_id}"
        if not with_stats:
            cached_user = cache.get(cache_key)
            if cached_user:
                return User(**cached_user) if isinstance(cached_user, dict) else None
        
        query = self.db.query(User).filter(User.clerk_id == clerk_id)
        
        if with_stats:
            query = query.options(joinedload(User.stats))
        
        user = query.first()
        
        # Cache user data (without relationships)
        if user and not with_stats:
            cache.set(cache_key, {
                "id": user.id,
                "clerk_id": user.clerk_id,
                "username": user.username,
                "email": user.email,
            }, ttl=3600)  # 1 hour
        
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
        clerk_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> User:
        user = User(
            clerk_id=clerk_id,
            username=username,
            email=email
        )
        return self.create(user)
    
    def update_last_login(self, user: User) -> User:
        user.last_login = datetime.utcnow()
        return self.update(user)
    
    def get_or_create(
        self, 
        clerk_id: str, 
        username: str, 
        email: Optional[str] = None
    ) -> tuple[User, bool]:
        user = self.get_by_clerk_id(clerk_id)
        
        if user:
            self.update_last_login(user)
            logger.info(f"User logged in: {username}")
            # Invalidate cache on update
            cache.delete(f"user:clerk:{clerk_id}")
            return user, False
        
        user = self.create_user(clerk_id, username, email)
        logger.info(f"Created new user: {username} (clerk_id: {clerk_id})")
        return user, True
