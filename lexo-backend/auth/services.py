from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from auth.models import UserDB
from auth.utils import get_password_hash, verify_password, generate_user_id
from auth.schemas import UserCreate
from typing import Optional

class UserService:
    def __init__(self, db: Session):
        self.db = db
    
    def create_user(self, user_data: UserCreate) -> UserDB:
        if self.get_user_by_email(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        if self.get_user_by_username(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        
        hashed_password = get_password_hash(user_data.password)
        db_user = UserDB(
            id=generate_user_id(),
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password
        )
        
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user
    
    def get_user_by_email(self, email: str) -> Optional[UserDB]:
        return self.db.query(UserDB).filter(UserDB.email == email).first()
    
    def get_user_by_username(self, username: str) -> Optional[UserDB]:
        return self.db.query(UserDB).filter(UserDB.username == username).first()
    
    def get_user_by_id(self, user_id: str) -> Optional[UserDB]:
        return self.db.query(UserDB).filter(UserDB.id == user_id).first()
    
    def authenticate_user(self, email: str, password: str) -> Optional[UserDB]:
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, str(user.hashed_password)):
            return None
        return user
