from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from core.database import get_db
from auth.utils import verify_token
from auth.services import UserService
from auth.models import UserDB
from typing import Optional

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> UserDB:
    print(f"DEBUG: Auth credentials received: {credentials.credentials[:10]}..." if credentials and credentials.credentials else "No credentials")
    token = credentials.credentials
    payload = verify_token(token)
    user_id = payload.get("sub")
    print(f"DEBUG: Extracted user_id from token: {user_id}")
    
    if user_id is None:
        print("DEBUG: No user_id in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_service = UserService(db)
    user = user_service.get_user_by_id(user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not getattr(user, 'is_active', True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user

async def get_current_user_optional(
    db: Session = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[UserDB]:
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        payload = verify_token(token)
        user_id = payload.get("sub")
        
        if user_id is None:
            return None
        
        user_service = UserService(db)
        user = user_service.get_user_by_id(user_id)
        
        if user is None or not getattr(user, 'is_active', True):
            return None
        
        return user
    except HTTPException:
        return None
