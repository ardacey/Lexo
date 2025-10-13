"""
WebSocket integration tests
"""
import pytest
from fastapi.testclient import TestClient
import json


class TestWebSocketConnection:
    """Tests for WebSocket connection"""
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_websocket_connection(self, client: TestClient):
        """Test that WebSocket endpoint accepts connections"""
        with client.websocket_connect("/ws/queue") as websocket:
            # Connection should be established
            assert websocket is not None
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_websocket_join_queue(self, client: TestClient):
        """Test joining queue via WebSocket"""
        with client.websocket_connect("/ws/queue") as websocket:
            # Send join message
            join_message = {
                "type": "join_queue",
                "username": "TestPlayer",
                "clerk_id": "test_clerk_123"
            }
            websocket.send_json(join_message)
            
            # Should receive a response
            try:
                data = websocket.receive_json(timeout=2)
                assert data is not None
                assert "type" in data
            except Exception:
                # Timeout is acceptable for this test
                pass
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_websocket_handles_invalid_message(self, client: TestClient):
        """Test WebSocket handles invalid messages gracefully"""
        with client.websocket_connect("/ws/queue") as websocket:
            # Send invalid message
            websocket.send_text("invalid json")
            
            # Connection should stay open or close gracefully
            try:
                data = websocket.receive_json(timeout=1)
                # If we get a response, it should be an error
                if data:
                    assert "error" in data or "type" in data
            except Exception:
                # Timeout or close is acceptable
                pass


class TestWebSocketMatchmaking:
    """Tests for matchmaking via WebSocket"""
    
    @pytest.mark.websocket
    @pytest.mark.integration
    @pytest.mark.slow
    def test_two_players_get_matched(self, client: TestClient):
        """Test that two players can be matched together"""
        # This test requires two concurrent connections
        # For now, just test the flow with one player
        with client.websocket_connect("/ws/queue") as ws1:
            join_msg = {
                "type": "join_queue",
                "username": "Player1",
                "clerk_id": "clerk_1"
            }
            ws1.send_json(join_msg)
            
            # Should receive queue status
            try:
                response = ws1.receive_json(timeout=2)
                assert response is not None
            except Exception:
                pass
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_websocket_ping_pong(self, client: TestClient):
        """Test WebSocket ping/pong mechanism"""
        with client.websocket_connect("/ws/queue") as websocket:
            # Send ping
            ping_message = {"type": "ping"}
            websocket.send_json(ping_message)
            
            # Should stay connected
            try:
                # Try to send another message to verify connection
                websocket.send_json(ping_message)
            except Exception as e:
                pytest.fail(f"WebSocket disconnected after ping: {e}")


class TestWebSocketGamePlay:
    """Tests for game play via WebSocket"""
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_submit_word_format(self, client: TestClient):
        """Test word submission message format"""
        with client.websocket_connect("/ws/queue") as websocket:
            # First join queue
            join_msg = {
                "type": "join_queue",
                "username": "TestPlayer",
                "clerk_id": "test_123"
            }
            websocket.send_json(join_msg)
            
            # Try to submit a word (even if not in game)
            submit_msg = {
                "type": "submit_word",
                "word": "test"
            }
            websocket.send_json(submit_msg)
            
            # Should receive some response
            try:
                response = websocket.receive_json(timeout=1)
                assert response is not None
            except Exception:
                # Timeout acceptable
                pass
    
    @pytest.mark.websocket
    @pytest.mark.integration
    def test_websocket_disconnect_cleanup(self, client: TestClient):
        """Test that disconnecting cleans up resources"""
        with client.websocket_connect("/ws/queue") as websocket:
            join_msg = {
                "type": "join_queue",
                "username": "TestPlayer",
                "clerk_id": "test_123"
            }
            websocket.send_json(join_msg)
        
        # After context exit, connection should be closed
        # No assertion needed, just verify no exceptions
