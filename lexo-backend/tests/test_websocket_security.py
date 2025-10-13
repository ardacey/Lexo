"""
Tests for WebSocket security features including authentication, rate limiting, and message validation.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
from fastapi import WebSocket
from datetime import datetime, timedelta

from app.websocket.auth import (
    authenticate_websocket,
    verify_clerk_jwt,
    WebSocketAuthError,
    RateLimiter,
    validate_message,
    send_error_response
)


class TestAuthentication:
    """Test WebSocket authentication"""
    
    @pytest.mark.asyncio
    async def test_authenticate_websocket_success(self):
        """Test successful authentication with clerk_id"""
        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.query_params = Mock()
        mock_ws.query_params.get = Mock(return_value=None)
        mock_ws.receive_json = AsyncMock(return_value={
            "clerk_id": "user_123",
            "username": "TestUser"
        })
        
        result = await authenticate_websocket(mock_ws)
        
        assert result["clerk_id"] == "user_123"
        assert result["username"] == "TestUser"
        assert result["is_reconnect"] is False
    
    @pytest.mark.asyncio
    async def test_authenticate_websocket_missing_clerk_id(self):
        """Test authentication fails when clerk_id is missing"""
        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.query_params = Mock()
        mock_ws.query_params.get = Mock(return_value=None)
        mock_ws.receive_json = AsyncMock(return_value={
            "username": "TestUser"
        })
        
        with pytest.raises(WebSocketAuthError, match="Failed to receive authentication data"):
            await authenticate_websocket(mock_ws)
    
    @pytest.mark.asyncio
    async def test_authenticate_websocket_reconnect(self):
        """Test authentication with reconnect flag"""
        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.query_params = Mock()
        mock_ws.query_params.get = Mock(return_value=None)
        mock_ws.receive_json = AsyncMock(return_value={
            "clerk_id": "user_123",
            "username": "TestUser",
            "is_reconnect": True
        })
        
        result = await authenticate_websocket(mock_ws)
        
        assert result["clerk_id"] == "user_123"
        assert result["is_reconnect"] is True


class TestRateLimiter:
    """Test rate limiting functionality"""
    
    def test_rate_limiter_initialization(self):
        """Test rate limiter initializes with correct defaults"""
        limiter = RateLimiter()
        assert limiter.max_messages == 30
        assert limiter.window_seconds == 10
    
    def test_rate_limiter_custom_limits(self):
        """Test rate limiter with custom limits"""
        limiter = RateLimiter(max_messages=10, window_seconds=5)
        assert limiter.max_messages == 10
        assert limiter.window_seconds == 5
    
    def test_rate_limiter_allows_within_limit(self):
        """Test rate limiter allows messages within limit"""
        limiter = RateLimiter(max_messages=5, window_seconds=10)
        user_id = "user_123"
        
        # Send 5 messages - all should pass
        for _ in range(5):
            assert limiter.is_allowed(user_id) is True
    
    def test_rate_limiter_blocks_over_limit(self):
        """Test rate limiter blocks messages over limit"""
        limiter = RateLimiter(max_messages=3, window_seconds=10)
        user_id = "user_123"
        
        # Send 3 messages - should pass
        for _ in range(3):
            assert limiter.is_allowed(user_id) is True
        
        # 4th message should be blocked
        assert limiter.is_allowed(user_id) is False
    
    def test_rate_limiter_resets_after_time_window(self):
        """Test rate limiter resets after time window expires"""
        limiter = RateLimiter(max_messages=2, window_seconds=1)  # 1 second window
        user_id = "user_123"
        
        # Send 2 messages
        assert limiter.is_allowed(user_id) is True
        assert limiter.is_allowed(user_id) is True
        
        # 3rd message blocked
        assert limiter.is_allowed(user_id) is False
        
        # Manually expire old messages
        import time
        time.sleep(1.1)  # Wait for time window to expire
        
        # Should allow new messages
        assert limiter.is_allowed(user_id) is True
    
    def test_rate_limiter_different_users(self):
        """Test rate limiter tracks users independently"""
        limiter = RateLimiter(max_messages=2, window_seconds=10)
        
        # User 1 sends 2 messages
        assert limiter.is_allowed("user_1") is True
        assert limiter.is_allowed("user_1") is True
        assert limiter.is_allowed("user_1") is False  # Blocked
        
        # User 2 should have independent limit
        assert limiter.is_allowed("user_2") is True
        assert limiter.is_allowed("user_2") is True
    
    def test_rate_limiter_reset(self):
        """Test manual reset of rate limiter"""
        limiter = RateLimiter(max_messages=2, window_seconds=10)
        user_id = "user_123"
        
        # Fill the limit
        assert limiter.is_allowed(user_id) is True
        assert limiter.is_allowed(user_id) is True
        assert limiter.is_allowed(user_id) is False
        
        # Reset for this user
        limiter.reset(user_id)
        
        # Should be able to send again
        assert limiter.is_allowed(user_id) is True


class TestMessageValidation:
    """Test message validation"""
    
    def test_validate_message_valid(self):
        """Test validation passes for valid messages"""
        valid_messages = [
            {"type": "submit_word", "word": "test"},
            {"type": "send_emoji", "emoji": "😀"},
            {"type": "ping"},
            {"type": "join_queue"},
            {"type": "leave_game"},
        ]
        
        for msg in valid_messages:
            assert validate_message(msg) is True
    
    def test_validate_message_missing_type(self):
        """Test validation fails for message without type"""
        message = {"word": "test"}
        assert validate_message(message) is False
    
    def test_validate_message_invalid_type(self):
        """Test validation fails for invalid message type"""
        message = {"type": "invalid_command"}
        assert validate_message(message) is False
    
    def test_validate_message_not_dict(self):
        """Test validation fails for non-dict messages"""
        invalid_messages = [
            "string_message",
            123,
            ["list"],
            None
        ]
        
        for msg in invalid_messages:
            assert validate_message(msg) is False
    
    def test_validate_message_word_too_long(self):
        """Test validation fails for excessively long words"""
        message = {"type": "submit_word", "word": "a" * 100}
        assert validate_message(message) is False
    
    def test_validate_message_word_invalid_characters(self):
        """Test validation fails for words with invalid characters"""
        invalid_words = [
            {"type": "submit_word", "word": "test123"},
            {"type": "submit_word", "word": "test!@#"},
            {"type": "submit_word", "word": "test<script>"},
        ]
        
        for msg in invalid_words:
            assert validate_message(msg) is False
    
    def test_validate_message_emoji_too_long(self):
        """Test validation fails for excessively long emoji strings"""
        message = {"type": "send_emoji", "emoji": "😀" * 20}
        assert validate_message(message) is False


class TestErrorResponses:
    """Test error response handling"""
    
    @pytest.mark.asyncio
    async def test_send_error_response(self):
        """Test sending error responses"""
        mock_ws = AsyncMock(spec=WebSocket)
        
        await send_error_response(mock_ws, "Test error message")
        
        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        
        assert call_args["type"] == "error"
        assert call_args["message"] == "Test error message"
    
    @pytest.mark.asyncio
    async def test_send_error_response_with_close(self):
        """Test error response with connection close"""
        mock_ws = AsyncMock(spec=WebSocket)
        
        await send_error_response(mock_ws, "Fatal error", close=True)
        
        mock_ws.send_json.assert_called_once()
        mock_ws.close.assert_called_once_with(code=1008)  # Policy Violation


class TestIntegrationSecurity:
    """Integration tests for security features"""
    
    @pytest.mark.asyncio
    async def test_full_authentication_flow(self):
        """Test complete authentication flow"""
        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.query_params = Mock()
        mock_ws.query_params.get = Mock(return_value=None)
        mock_ws.receive_json = AsyncMock(return_value={
            "clerk_id": "user_123",
            "username": "TestUser"
        })
        
        user_data = await authenticate_websocket(mock_ws)
        
        # Verify user is authenticated
        assert user_data["clerk_id"] == "user_123"
        assert user_data["username"] == "TestUser"
        
        # Create rate limiter for user
        limiter = RateLimiter()
        
        # Simulate message sending
        for i in range(30):
            assert limiter.is_allowed(user_data["clerk_id"]) is True
        
        # 31st message should be blocked
        assert limiter.is_allowed(user_data["clerk_id"]) is False
    
    @pytest.mark.asyncio
    async def test_security_prevents_unauthorized_access(self):
        """Test that security measures prevent unauthorized access"""
        mock_ws = AsyncMock(spec=WebSocket)
        mock_ws.query_params = Mock()
        mock_ws.query_params.get = Mock(return_value=None)
        
        # Test: Missing clerk_id
        mock_ws.receive_json = AsyncMock(return_value={"username": "TestUser"})
        
        with pytest.raises(WebSocketAuthError, match="Failed to receive authentication data"):
            await authenticate_websocket(mock_ws)
    
    @pytest.mark.asyncio
    async def test_rate_limiting_with_message_validation(self):
        """Test rate limiting combined with message validation"""
        limiter = RateLimiter(max_messages=5, window_seconds=10)
        user_id = "user_123"
        
        # Send valid messages up to limit (use Turkish words without numbers)
        words = ["test", "kelime", "oyun", "skor", "zaman"]
        for i in range(5):
            message = {"type": "submit_word", "word": words[i]}
            assert validate_message(message) is True
            assert limiter.is_allowed(user_id) is True
        
        # 6th message should be rate limited
        message = {"type": "submit_word", "word": "başka"}
        assert validate_message(message) is True  # Message is valid
        assert limiter.is_allowed(user_id) is False  # But rate limited
    
    @pytest.mark.asyncio
    async def test_invalid_message_handling(self):
        """Test handling of invalid messages"""
        # Test various invalid message types
        invalid_messages = [
            "string",  # Not a dict
            {"word": "test"},  # Missing type
            {"type": "invalid_command"},  # Invalid type
            {"type": "submit_word", "word": "test123"},  # Invalid characters
        ]
        
        for msg in invalid_messages:
            assert validate_message(msg) is False
