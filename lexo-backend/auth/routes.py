from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from datetime import timedelta
from core.database import get_db
from auth.schemas import UserCreate, UserLogin, UserResponse, Token
from auth.services import UserService
from auth.utils import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from auth.dependencies import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse, tags=["Authentication"])
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    user_service = UserService(db)
    user = user_service.create_user(user_data)
    return user

@router.post("/login", response_model=Token, tags=["Authentication"])
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user_service = UserService(db)
    user = user_service.authenticate_user(user_data.email, user_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(current_user = Depends(get_current_user)):
    return current_user

@router.post("/logout", tags=["Authentication"])
async def logout():
    return {"message": "Successfully logged out"}
