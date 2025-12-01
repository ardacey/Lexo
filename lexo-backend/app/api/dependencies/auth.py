"""FastAPI dependencies for Supabase authentication."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import Depends, Header, HTTPException, Request, status

from app.security.supabase import SupabaseAuthError, verify_supabase_jwt

AuthenticatedUser = Dict[str, Any]
_PREFLIGHT_TOKEN = "__preflight__"


async def get_bearer_token(
    request: Request,
    authorization: str | None = Header(default=None)
) -> str:
    """Extract Bearer token from Authorization header."""
    if request.method.upper() == "OPTIONS":
        return _PREFLIGHT_TOKEN

    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token


async def get_current_user(token: str = Depends(get_bearer_token)) -> AuthenticatedUser:
    """Validate Supabase token and return the authenticated user claims."""
    if token == _PREFLIGHT_TOKEN:
        return {"user_id": "preflight", "claims": {}}

    try:
        claims = await verify_supabase_jwt(token)
    except SupabaseAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"user_id": user_id, "claims": claims}
