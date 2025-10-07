from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class UserRepository(BaseRepository[User]):
    
    def __init__(self, db: Session):
        super().__init__(User, db)
    
    def get_by_clerk_id(self, clerk_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.clerk_id == clerk_id).first()
    
    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()
    
    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()
    
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
            return user, False
        
        user = self.create_user(clerk_id, username, email)
        logger.info(f"Created new user: {username} (clerk_id: {clerk_id})")
        return user, True
