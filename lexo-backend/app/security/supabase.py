"""Supabase authentication utilities for HTTP and WebSocket flows."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict

import httpx
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError, PyJWKClient

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_jwks_client: PyJWKClient | None = None


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


def _get_jwks_client() -> PyJWKClient:
    """Get or create JWKS client for Supabase."""
    global _jwks_client
    if _jwks_client is None:
        supabase_url = _get_supabase_url()
        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
        logger.info(f"Created JWKS client for {jwks_url}")
    return _jwks_client


async def verify_supabase_jwt(token: str) -> Dict[str, Any]:
    """Verify a Supabase-issued JWT using JWKS or legacy secret."""

    if not token:
        raise SupabaseAuthError("Authentication token is required")

    try:
        # First, decode header to check the algorithm
        unverified_header = jwt.get_unverified_header(token)
        algorithm = unverified_header.get("alg", "HS256")
        
        logger.info(f"Token algorithm: {algorithm}")
        
        # Decode without verification first to see what's in the token
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logger.info(f"Token payload (unverified): sub={unverified_payload.get('sub')}, aud={unverified_payload.get('aud')}")
        
        if algorithm == "ES256":
            # Use JWKS for ES256 tokens (new Supabase keys)
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                options={
                    "require": ["exp", "sub"],
                    "verify_exp": True,
                },
                audience="authenticated",
            )
        else:
            # Use legacy JWT secret for HS256 tokens
            jwt_secret = _get_jwt_secret()
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
        
        logger.info(f"Successfully verified Supabase JWT for user: {payload.get('sub')}")
        return payload
        
    except ExpiredSignatureError as exc:
        logger.warning("Supabase token has expired")
        raise SupabaseAuthError("Token has expired") from exc
    except InvalidTokenError as exc:
        logger.warning(f"Invalid Supabase token: {exc}")
        raise SupabaseAuthError(f"Invalid token: {exc}") from exc
    except Exception as exc:
        logger.error(f"Unexpected error during JWT verification: {exc}")
        raise SupabaseAuthError(f"Authentication failed: {exc}") from exc


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
