"""FastAPI dependencies for Clerk authentication."""
from __future__ import annotations

from typing import Any, Dict

from fastapi import Depends, Header, HTTPException, Request, status

from app.security.clerk import ClerkAuthError, verify_clerk_jwt

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
    """Validate Clerk token and return the authenticated user claims."""
    if token == _PREFLIGHT_TOKEN:
        return {"clerk_id": "preflight", "claims": {}}

    try:
        claims = await verify_clerk_jwt(token)
    except ClerkAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    clerk_id = claims.get("sub")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"clerk_id": clerk_id, "claims": claims}
