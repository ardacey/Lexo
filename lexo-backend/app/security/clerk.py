"""Shared Clerk authentication utilities for HTTP and WebSocket flows."""
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


class ClerkAuthError(Exception):
    """Raised when Clerk token validation fails."""


def _get_issuer() -> str:
    issuer = settings.clerk.issuer_url.rstrip('/') if settings.clerk.issuer_url else ''
    if not issuer:
        logger.error("Clerk issuer URL is not configured")
        raise ClerkAuthError("Clerk issuer URL is not configured")
    return issuer


async def _get_clerk_jwks(force_refresh: bool = False) -> Dict[str, Any]:
    global _jwks_cache, _jwks_cache_expires_at

    issuer = _get_issuer()

    async with _jwks_lock:
        now = datetime.utcnow()
        if (
            not force_refresh
            and _jwks_cache is not None
            and _jwks_cache_expires_at is not None
            and now < _jwks_cache_expires_at
        ):
            return _jwks_cache

        jwks_url = f"{issuer}/.well-known/jwks.json"

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(jwks_url)
                response.raise_for_status()
                _jwks_cache = response.json()
                ttl = max(60, settings.clerk.jwks_cache_ttl_seconds)
                _jwks_cache_expires_at = now + timedelta(seconds=ttl)
                logger.debug("Refreshed Clerk JWKS")
                return _jwks_cache
        except httpx.HTTPError as exc:
            logger.error(f"Unable to fetch Clerk JWKS: {exc}")
            raise ClerkAuthError("Unable to fetch Clerk signing keys") from exc


def _build_public_key(key_data: Dict[str, Any]):
    try:
        return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(f"Unable to construct public key: {exc}")
        raise ClerkAuthError("Unable to construct signing key") from exc


async def verify_clerk_jwt(token: str) -> Dict[str, Any]:
    """Verify a Clerk-issued JWT using JWKS."""

    if not token:
        raise ClerkAuthError("Authentication token is required")

    try:
        headers = jwt.get_unverified_header(token)
    except jwt.JWTError as exc:
        raise ClerkAuthError("Invalid token header") from exc

    kid = headers.get("kid")
    if not kid:
        raise ClerkAuthError("Token is missing key identifier")

    jwks = await _get_clerk_jwks()
    keys = jwks.get("keys", [])
    key_data = next((key for key in keys if key.get("kid") == kid), None)

    if key_data is None:
        # The key might have rotated; refresh cache once and retry.
        jwks = await _get_clerk_jwks(force_refresh=True)
        keys = jwks.get("keys", [])
        key_data = next((key for key in keys if key.get("kid") == kid), None)

    if key_data is None:
        raise ClerkAuthError("Unable to find signing key for token")

    public_key = _build_public_key(key_data)

    issuer = _get_issuer()
    audience = settings.clerk.audience

    options = {"require": ["exp", "iat", "sub"], "verify_aud": bool(audience)}

    decode_kwargs: Dict[str, Any] = {
        "algorithms": [key_data.get("alg", "RS256")],
        "issuer": issuer,
        "options": options,
    }

    if audience:
        decode_kwargs["audience"] = audience

    try:
        return jwt.decode(token, public_key, **decode_kwargs)
    except ExpiredSignatureError as exc:
        raise ClerkAuthError("Token has expired") from exc
    except InvalidTokenError as exc:
        raise ClerkAuthError(f"Invalid token: {exc}") from exc
    except Exception as exc:  # pragma: no cover - defensive
        logger.error(f"Unexpected error during JWT verification: {exc}")
        raise ClerkAuthError("Authentication failed") from exc
