"""Supabase authentication utilities for HTTP and WebSocket flows."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict

import httpx
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_jwks_cache: Dict[str, Any] | None = None
_jwks_cache_expires_at: datetime | None = None
_jwks_lock = asyncio.Lock()


class SupabaseAuthError(Exception):
    """Raised when Supabase token validation fails."""


def _get_jwt_secret() -> str:
    """Get JWT secret from settings."""
    secret = settings.supabase.jwt_secret
    if not secret:
        logger.error("Supabase JWT secret is not configured")
        raise SupabaseAuthError("Supabase JWT secret is not configured")
    return secret


def _get_supabase_url() -> str:
    """Get Supabase URL from settings."""
    url = settings.supabase.url
    if not url:
        logger.error("Supabase URL is not configured")
        raise SupabaseAuthError("Supabase URL is not configured")
    return url.rstrip('/')


async def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """Verify a Supabase-issued JWT using the JWT secret."""

    if not token:
        raise SupabaseAuthError("Authentication token is required")

    jwt_secret = _get_jwt_secret()
    
    try:
        # Supabase uses HS256 algorithm with JWT secret
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={
                "require": ["exp", "sub"],
                "verify_exp": True,
            },
            audience="authenticated",
        )
        
        logger.debug(f"Successfully verified Supabase JWT for user: {payload.get('sub')}")
        return payload
        
    except ExpiredSignatureError as exc:
        logger.warning("Supabase token has expired")
        raise SupabaseAuthError("Token has expired") from exc
    except InvalidTokenError as exc:
        logger.warning(f"Invalid Supabase token: {exc}")
        raise SupabaseAuthError(f"Invalid token: {exc}") from exc
    except Exception as exc:
        logger.error(f"Unexpected error during JWT verification: {exc}")
        raise SupabaseAuthError("Authentication failed") from exc


async def get_user_from_supabase(user_id: str) -> Dict[str, Any] | None:
    """Fetch user details from Supabase Admin API (optional, for enriching user data)."""
    
    supabase_url = _get_supabase_url()
    service_role_key = settings.supabase.service_role_key
    
    if not service_role_key:
        logger.warning("Supabase service role key not configured, skipping user fetch")
        return None
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/admin/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                }
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to fetch user from Supabase: {response.status_code}")
                return None
                
    except httpx.HTTPError as exc:
        logger.error(f"Error fetching user from Supabase: {exc}")
        return None
