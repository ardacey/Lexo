from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from auth.models import UserDB, RefreshTokenDB
from auth.utils import get_password_hash, verify_password, generate_user_id, generate_refresh_token_id, create_refresh_token, verify_token, REFRESH_TOKEN_EXPIRE_DAYS
from auth.schemas import UserCreate
from typing import Optional
from datetime import datetime, timedelta

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
    
    def create_refresh_token(self, user_id: str) -> RefreshTokenDB:
        self.revoke_user_refresh_tokens(user_id)

        token_id = generate_refresh_token_id()
        expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        token_data = {"sub": user_id, "jti": token_id}
        token = create_refresh_token(token_data)
        
        db_refresh_token = RefreshTokenDB(
            id=token_id,
            token=token,
            user_id=user_id,
            expires_at=expires_at
        )
        
        self.db.add(db_refresh_token)
        self.db.commit()
        self.db.refresh(db_refresh_token)
        return db_refresh_token
    
    def get_refresh_token(self, token: str) -> Optional[RefreshTokenDB]:
        return self.db.query(RefreshTokenDB).filter(
            RefreshTokenDB.token == token,
            RefreshTokenDB.is_revoked == False,
            RefreshTokenDB.expires_at > datetime.utcnow()
        ).first()
    
    def revoke_refresh_token(self, token: str) -> bool:
        result = self.db.query(RefreshTokenDB).filter(
            RefreshTokenDB.token == token
        ).update({"is_revoked": True})
        
        self.db.commit()
        return result > 0
    
    def revoke_user_refresh_tokens(self, user_id: str) -> bool:
        result = self.db.query(RefreshTokenDB).filter(
            RefreshTokenDB.user_id == user_id,
            RefreshTokenDB.is_revoked == False
        ).update({"is_revoked": True})
        
        self.db.commit()
        return result > 0
    
    def verify_refresh_token(self, token: str) -> Optional[UserDB]:
        try:
            payload = verify_token(token, "refresh")
            user_id = payload.get("sub")
            token_id = payload.get("jti")
            
            if not user_id or not token_id:
                return None

            db_token = self.get_refresh_token(token)
            if not db_token or db_token.id != token_id:
                return None

            user = self.get_user_by_id(user_id)
            return user
        except Exception:
            return None
