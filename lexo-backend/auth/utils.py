from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
import os
import uuid
import secrets
import logging

logger = logging.getLogger(__name__)

try:
    from jose import JWTError, jwt
    JWT_AVAILABLE = True
except ImportError:
    logger.warning("JWT library not available")
    JWT_AVAILABLE = False
    JWTError = Exception
    jwt = None

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(
        schemes=["bcrypt"], 
        deprecated="auto",
        bcrypt__rounds=12
    )
    BCRYPT_AVAILABLE = True
except ImportError:
    logger.warning("Passlib not available")
    pwd_context = None
    BCRYPT_AVAILABLE = False

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    logger.warning("SECRET_KEY not set, generating random key (not recommended for production)")
    SECRET_KEY = secrets.token_urlsafe(32)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

def validate_password_strength(password: str) -> bool:
    if len(password) < 8:
        return False
    if not any(c.isupper() for c in password):
        return False
    if not any(c.islower() for c in password):
        return False
    if not any(c.isdigit() for c in password):
        return False
    return True

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not BCRYPT_AVAILABLE or pwd_context is None:
        raise HTTPException(status_code=500, detail="Password verification not available")
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    if not BCRYPT_AVAILABLE or pwd_context is None:
        raise HTTPException(status_code=500, detail="Password hashing not available")
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    if not JWT_AVAILABLE or jwt is None:
        raise HTTPException(status_code=500, detail="JWT encoding not available")
    
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY not configured")
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "access"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    if not JWT_AVAILABLE or jwt is None:
        raise HTTPException(status_code=500, detail="JWT encoding not available")
    
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="SECRET_KEY not configured")
    
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def generate_refresh_token_id() -> str:
    return str(uuid.uuid4())

def verify_token(token: str, token_type: str = "access") -> dict:
    print(f"DEBUG: Verifying {token_type} token: {token[:10]}...")
    if not JWT_AVAILABLE or jwt is None:
        print("DEBUG: JWT not available")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT verification not available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not SECRET_KEY:
        print("DEBUG: SECRET_KEY not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SECRET_KEY not configured"
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_type_from_payload = payload.get("type", "access")
        
        print(f"DEBUG: Token payload decoded, user_id: {user_id}, token_type: {token_type_from_payload}")
        
        if user_id is None:
            print("DEBUG: No sub claim in token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if token_type_from_payload != token_type:
            print(f"DEBUG: Token type mismatch. Expected: {token_type}, Got: {token_type_from_payload}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
    except JWTError as e:
        print(f"DEBUG: JWT verification failed: {e}")
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def generate_user_id() -> str:
    return str(uuid.uuid4())
