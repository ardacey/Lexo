"""
WebSocket authentication utilities
"""
from typing import Optional, Dict
from fastapi import WebSocket, WebSocketDisconnect
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError
import os

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


class WebSocketAuthError(Exception):
    """Exception raised for WebSocket authentication errors"""
    pass


async def authenticate_websocket(websocket: WebSocket) -> Dict[str, str]:
    """
    Authenticate WebSocket connection using JWT token from query params or first message.
    
    Returns:
        Dict with user info (clerk_id, username)
    
    Raises:
        WebSocketAuthError: If authentication fails
    """
    # Try to get token from query params first
    token = websocket.query_params.get("token")
    
    if not token:
        # If no token in query params, wait for first message with token
        try:
            data = await websocket.receive_json()
            
            token = data.get("token")
            clerk_id = data.get("clerk_id")
            username = data.get("username", "Player")
            is_reconnect = data.get("is_reconnect", False)
            
            if not clerk_id:
                logger.error(f"Clerk ID missing in authentication data")
                raise WebSocketAuthError("Clerk ID is required")
            
            # For now, we'll trust the clerk_id from frontend
            # In production, you should verify the Clerk JWT token
            return {
                "clerk_id": clerk_id,
                "username": username,
                "is_reconnect": is_reconnect,
                "initial_data": data
            }
            
        except WebSocketAuthError:
            raise
        except Exception as e:
            logger.error(f"Error receiving authentication data: {e}")
            raise WebSocketAuthError(f"Failed to receive authentication data: {str(e)}")
    
    # If token is provided in query params, verify it
    try:
        # Note: In production, use Clerk's public key to verify the token
        # For now, we'll do basic JWT decoding without verification
        # You should add proper Clerk JWT verification here
        payload = jwt.decode(token, options={"verify_signature": False})
        
        clerk_id = payload.get("sub")
        username = payload.get("username") or payload.get("email", "Player")
        
        if not clerk_id:
            raise WebSocketAuthError("Invalid token: missing user ID")
        
        return {
            "clerk_id": clerk_id,
            "username": username,
            "is_reconnect": False,
            "initial_data": None
        }
        
    except ExpiredSignatureError:
        raise WebSocketAuthError("Token has expired")
    except InvalidTokenError as e:
        raise WebSocketAuthError(f"Invalid token: {str(e)}")
    except Exception as e:
        logger.error(f"Error verifying token: {e}")
        raise WebSocketAuthError("Authentication failed")


def verify_clerk_jwt(token: str) -> Optional[Dict]:
    """
    Verify Clerk JWT token.
    
    In production, this should use Clerk's public key from their JWKS endpoint.
    For now, we'll do basic validation.
    
    Args:
        token: JWT token from Clerk
        
    Returns:
        Decoded token payload if valid, None otherwise
    """
    try:
        # TODO: Implement proper Clerk JWT verification
        # 1. Fetch Clerk's JWKS from https://clerk.YOUR_DOMAIN/.well-known/jwks.json
        # 2. Verify the token signature using the public key
        # 3. Verify token claims (exp, iss, etc.)
        
        # For now, decode without verification (NOT SECURE FOR PRODUCTION)
        payload = jwt.decode(token, options={"verify_signature": False})
        
        # Basic validation
        if not payload.get("sub"):
            return None
            
        return payload
        
    except Exception as e:
        logger.error(f"Error verifying Clerk JWT: {e}")
        return None


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
        # Check for suspicious characters - allow Turkish letters
        # Turkish alphabet: a-z, ç, ğ, ı, i, ö, ş, ü
        if not word.strip():
            logger.warning(f"Word is empty or whitespace")
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
