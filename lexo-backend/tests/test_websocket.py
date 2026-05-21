"""
Unit tests for WebSocket connection handlers.

These tests exercise the authentication and connection-lifecycle paths of
GameWebSocketHandler and NotificationWebSocketHandler without requiring a
running database, Redis server, or full app startup.  All external I/O is
replaced with AsyncMocks.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import WebSocket, WebSocketDisconnect

from app.websocket.game_handler import GameWebSocketHandler
from app.websocket.notification_handler import NotificationWebSocketHandler
from app.websocket.auth import WebSocketAuthError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_ws() -> MagicMock:
    """Minimal WebSocket stub with async methods."""
    ws = MagicMock(spec=WebSocket)
    ws.accept = AsyncMock()
    ws.close = AsyncMock()
    ws.send_json = AsyncMock()
    ws.receive_json = AsyncMock()
    return ws


def make_game_handler() -> GameWebSocketHandler:
    return GameWebSocketHandler(
        matchmaking_service=MagicMock(),
        word_service=MagicMock(),
        bridge=AsyncMock(),
    )


def make_notify_handler() -> NotificationWebSocketHandler:
    return NotificationWebSocketHandler(
        matchmaking_service=MagicMock(),
        bridge=AsyncMock(),
    )


# ---------------------------------------------------------------------------
# GameWebSocketHandler — authentication
# ---------------------------------------------------------------------------

class TestGameHandlerAuth:
    async def test_accepts_connection_before_auth(self):
        """websocket.accept() must be called even when auth fails."""
        handler = make_game_handler()
        ws = make_ws()

        with patch(
            "app.websocket.game_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("bad token")),
        ):
            await handler.handle_connection(ws)

        ws.accept.assert_awaited_once()

    async def test_auth_failure_sends_error_and_closes(self):
        """
        On auth failure the handler should send a JSON error and close
        with policy-violation code 1008.
        """
        handler = make_game_handler()
        ws = make_ws()

        with patch(
            "app.websocket.game_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("expired token")),
        ):
            await handler.handle_connection(ws)

        ws.send_json.assert_awaited_once()
        sent = ws.send_json.call_args[0][0]
        assert sent["type"] == "error"

        ws.close.assert_awaited_once_with(code=1008)

    async def test_auth_failure_does_not_register_with_bridge(self):
        """A failed auth must not add the user to the bridge."""
        bridge = AsyncMock()
        handler = GameWebSocketHandler(
            matchmaking_service=MagicMock(),
            word_service=MagicMock(),
            bridge=bridge,
        )
        ws = make_ws()

        with patch(
            "app.websocket.game_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("no token")),
        ):
            await handler.handle_connection(ws)

        bridge.register.assert_not_awaited()


# ---------------------------------------------------------------------------
# NotificationWebSocketHandler — authentication
# ---------------------------------------------------------------------------

class TestNotificationHandlerAuth:
    async def test_accepts_connection_before_auth(self):
        """websocket.accept() must be called even when auth fails."""
        handler = make_notify_handler()
        ws = make_ws()

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("bad token")),
        ):
            await handler.handle_connection(ws)

        ws.accept.assert_awaited_once()

    async def test_auth_failure_closes_with_1008(self):
        """Handler must close the connection with 1008 on auth failure."""
        handler = make_notify_handler()
        ws = make_ws()

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("invalid token")),
        ):
            await handler.handle_connection(ws)

        ws.close.assert_awaited_once_with(code=1008)

    async def test_auth_failure_does_not_register_with_bridge(self):
        """A failed auth must not register the user in the bridge."""
        bridge = AsyncMock()
        handler = NotificationWebSocketHandler(
            matchmaking_service=MagicMock(),
            bridge=bridge,
        )
        ws = make_ws()

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(side_effect=WebSocketAuthError("no token")),
        ):
            await handler.handle_connection(ws)

        bridge.register.assert_not_awaited()


# ---------------------------------------------------------------------------
# NotificationWebSocketHandler — connection lifecycle
# ---------------------------------------------------------------------------

class TestNotificationHandlerLifecycle:
    async def test_registers_user_on_successful_auth(self):
        """After successful auth the user must be registered with the bridge."""
        bridge = AsyncMock()
        bridge.refresh_ttl = AsyncMock()
        handler = NotificationWebSocketHandler(
            matchmaking_service=MagicMock(), bridge=bridge
        )
        ws = make_ws()
        # Disconnect immediately after auth so the loop exits
        ws.receive_json = AsyncMock(side_effect=WebSocketDisconnect())

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(return_value={"user_id": "u1"}),
        ):
            await handler.handle_connection(ws)

        bridge.register.assert_awaited_once_with("u1", ws, channel="notify")

    async def test_unregisters_user_on_disconnect(self):
        """Bridge.unregister must be called in the finally block on disconnect."""
        bridge = AsyncMock()
        bridge.refresh_ttl = AsyncMock()
        handler = NotificationWebSocketHandler(
            matchmaking_service=MagicMock(), bridge=bridge
        )
        ws = make_ws()
        ws.receive_json = AsyncMock(side_effect=WebSocketDisconnect())

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(return_value={"user_id": "u1"}),
        ):
            await handler.handle_connection(ws)

        bridge.unregister.assert_awaited_once_with("u1", ws, channel="notify")

    async def test_ping_replies_with_pong(self):
        """
        A 'ping' message should trigger a 'pong' reply and a TTL refresh
        before the connection eventually closes.
        """
        bridge = AsyncMock()
        bridge.refresh_ttl = AsyncMock()
        handler = NotificationWebSocketHandler(
            matchmaking_service=MagicMock(), bridge=bridge
        )
        ws = make_ws()
        # First receive returns ping, second raises disconnect
        ws.receive_json = AsyncMock(
            side_effect=[{"type": "ping"}, WebSocketDisconnect()]
        )

        with patch(
            "app.websocket.notification_handler.authenticate_websocket",
            AsyncMock(return_value={"user_id": "u1"}),
        ):
            await handler.handle_connection(ws)

        # pong was sent
        pong_calls = [
            call for call in ws.send_json.call_args_list
            if call[0][0].get("type") == "pong"
        ]
        assert len(pong_calls) == 1

        # TTL was refreshed
        bridge.refresh_ttl.assert_awaited_once_with("u1", channel="notify")
