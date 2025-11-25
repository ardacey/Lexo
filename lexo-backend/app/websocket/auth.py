"""
WebSocket authentication utilities
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, Any

import httpx
import jwt
from fastapi import WebSocket
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)

_jwks_cache: Dict[str, Any] | None = None
_jwks_cache_expires_at: datetime | None = None
_jwks_lock = asyncio.Lock()


class WebSocketAuthError(Exception):
    """Exception raised for WebSocket authentication errors"""
    pass


async def authenticate_websocket(websocket: WebSocket) -> Dict[str, Any]:
    """
    Authenticate WebSocket connection using JWT token from query params or first message.
    
    Returns:
        Dict with user info (clerk_id, username)
    
    Raises:
        WebSocketAuthError: If authentication fails
    """
    token = websocket.query_params.get("token")
    initial_data: Dict[str, Any] | None = None
    
    if not token:
        try:
            data = await websocket.receive_json()
        except Exception as exc:
            logger.error(f"Error receiving authentication data: {exc}")
            raise WebSocketAuthError("Failed to receive authentication data")

        token = data.get("token")
        if not token:
            logger.error("Authentication token missing from initial payload")
            raise WebSocketAuthError("Authentication token is required")
        initial_data = data
    
    payload = await verify_clerk_jwt(token)

    clerk_id = payload.get("sub")
    if not clerk_id:
        raise WebSocketAuthError("Token missing subject claim")

    username = (
        payload.get("username")
        or payload.get("email")
        or payload.get("name")
        or (initial_data or {}).get("username")
        or "Player"
    )

    is_reconnect = bool((initial_data or {}).get("is_reconnect", False))

    return {
        "clerk_id": clerk_id,
        "username": username,
        "is_reconnect": is_reconnect,
        "initial_data": initial_data,
        "token_claims": payload,
    }


async def _get_clerk_jwks(force_refresh: bool = False) -> Dict[str, Any]:
    global _jwks_cache, _jwks_cache_expires_at

    issuer = settings.clerk.issuer_url.rstrip('/') if settings.clerk.issuer_url else ''
    if not issuer:
        logger.error("Clerk issuer URL is not configured")
        raise WebSocketAuthError("Clerk issuer URL is not configured")

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
            raise WebSocketAuthError("Unable to fetch Clerk signing keys") from exc


async def verify_clerk_jwt(token: str) -> Dict[str, Any]:
    """Verify a Clerk-issued JWT using JWKS."""

    if not token:
        raise WebSocketAuthError("Authentication token is required")

    try:
        headers = jwt.get_unverified_header(token)
    except jwt.JWTError as exc:
        raise WebSocketAuthError("Invalid token header") from exc

    kid = headers.get("kid")
    if not kid:
        raise WebSocketAuthError("Token is missing key identifier")

    jwks = await _get_clerk_jwks()
    keys = jwks.get("keys", [])
    key_data = next((key for key in keys if key.get("kid") == kid), None)

    if key_data is None:
        # The key might have rotated; refresh cache once and retry.
        jwks = await _get_clerk_jwks(force_refresh=True)
        keys = jwks.get("keys", [])
        key_data = next((key for key in keys if key.get("kid") == kid), None)

    if key_data is None:
        raise WebSocketAuthError("Unable to find signing key for token")

    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))

    issuer = settings.clerk.issuer_url.rstrip('/')
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
        raise WebSocketAuthError("Token has expired") from exc
    except InvalidTokenError as exc:
        raise WebSocketAuthError(f"Invalid token: {exc}") from exc
    except Exception as exc:
        logger.error(f"Unexpected error during JWT verification: {exc}")
        raise WebSocketAuthError("Authentication failed") from exc


class RateLimiter:
    """
    Simple rate limiter for WebSocket messages.
    Prevents spam and DDoS attacks.
    """
    
    def __init__(self, max_messages: int = 30, window_seconds: int = 10):
        self.max_messages = max_messages
        self.window_seconds = window_seconds
        self.message_counts: Dict[str, list] = {}
    
    def is_allowed(self, client_id: str) -> bool:
        """
        Check if client is allowed to send a message based on rate limit.
        
        Args:
            client_id: Unique identifier for the client (e.g., clerk_id)
            
        Returns:
            True if allowed, False if rate limit exceeded
        """
        from datetime import datetime, timedelta
        
        now = datetime.now()
        
        if client_id not in self.message_counts:
            self.message_counts[client_id] = []
        
        # Remove old messages outside the time window
        cutoff_time = now - timedelta(seconds=self.window_seconds)
        self.message_counts[client_id] = [
            timestamp for timestamp in self.message_counts[client_id]
            if timestamp > cutoff_time
        ]
        
        # Check if under limit
        if len(self.message_counts[client_id]) >= self.max_messages:
            logger.warning(f"Rate limit exceeded for client {client_id}")
            return False
        
        # Add current message timestamp
        self.message_counts[client_id].append(now)
        return True
    
    def reset(self, client_id: str):
        """Reset rate limit for a client"""
        if client_id in self.message_counts:
            del self.message_counts[client_id]


def validate_message(message: Dict) -> bool:
    """
    Validate incoming WebSocket message structure.
    Prevents malicious or malformed messages.
    
    Args:
        message: Message dictionary to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not isinstance(message, dict):
        return False
    
    # Must have a type field
    if "type" not in message:
        return False
    
    message_type = message.get("type")
    
    # Validate based on message type
    valid_types = [
        "join_queue",
        "submit_word",
        "leave_game",
        "send_emoji",
        "ping",
        "pong"
    ]
    
    if message_type not in valid_types:
        logger.warning(f"Invalid message type: {message_type}")
        return False
    
    # Type-specific validation
    if message_type == "submit_word":
        word = message.get("word", "")
        if not isinstance(word, str):
            logger.warning(f"Word is not a string: {type(word)}")
            return False
        if len(word) > 50:  # Reasonable max length
            logger.warning(f"Word too long: {len(word)} characters")
            return False
        if not word.strip():
            logger.warning(f"Word is empty or whitespace")
            return False
        import re
        # Only allow Turkish alphabet (upper/lower), no digits or symbols
        if not re.fullmatch(r"[a-zA-ZçÇğĞıİöÖşŞüÜ]+", word):
            logger.warning(f"Word contains invalid characters: {word}")
            return False
    
    elif message_type == "send_emoji":
        emoji = message.get("emoji", "")
        if not isinstance(emoji, str):
            logger.warning(f"Emoji is not a string: {type(emoji)}")
            return False
        if not emoji:
            logger.warning(f"Emoji is empty")
            return False
        if len(emoji) > 10:  # Emojis should be short
            logger.warning(f"Emoji too long: {len(emoji)} characters")
            return False
    
    return True


async def send_error_response(websocket: WebSocket, message: str, close: bool = False):
    """
    Send error response to client without leaking sensitive information.
    
    Args:
        websocket: WebSocket connection
        message: User-friendly error message
        close: Whether to close the connection after sending error
    """
    try:
        await websocket.send_json({
            "type": "error",
            "message": message
        })
        
        if close:
            await websocket.close(code=1008)  # Policy Violation
            
    except Exception as e:
        logger.error(f"Error sending error response: {e}")
