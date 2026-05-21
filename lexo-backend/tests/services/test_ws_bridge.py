"""
Tests for WebSocketBridge.

Uses fakeredis for Redis operations and AsyncMock WebSocket stubs.
The Pub/Sub listener task (_listen) is not started in these unit tests —
we exercise the local fast-path and the remote Redis-publish path directly.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import fakeredis.aioredis as fakeredis

from app.services.ws_bridge import WebSocketBridge


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_ws() -> MagicMock:
    """Return a minimal WebSocket stub whose async methods are AsyncMocks."""
    ws = MagicMock()
    ws.send_json = AsyncMock()
    return ws


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def redis():
    r = fakeredis.FakeRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest.fixture
def bridge(redis):
    b = WebSocketBridge(redis)
    b.worker_id = "test-worker"
    b._channel = f"ws:worker:{b.worker_id}"
    return b


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegistration:
    async def test_register_stores_locally(self, bridge):
        ws = make_ws()
        await bridge.register("u1", ws)
        assert bridge.get_local_websocket("u1") is ws

    async def test_register_writes_redis_key(self, bridge, redis):
        await bridge.register("u1", make_ws())
        val = await redis.get("player:u1:ws:worker:game")
        assert val == "test-worker"

    async def test_unregister_removes_local(self, bridge):
        ws = make_ws()
        await bridge.register("u1", ws)
        await bridge.unregister("u1")
        assert bridge.get_local_websocket("u1") is None

    async def test_unregister_deletes_redis_key(self, bridge, redis):
        await bridge.register("u1", make_ws())
        await bridge.unregister("u1")
        assert not await redis.exists("player:u1:ws:worker:game")

    async def test_unregister_nonexistent_is_safe(self, bridge):
        """Unregistering a user that was never registered should not raise."""
        await bridge.unregister("nobody")  # must not raise

    async def test_refresh_ttl_extends_key(self, bridge, redis):
        await bridge.register("u1", make_ws())
        # Drain the TTL partially by setting a shorter expiry
        await redis.expire("player:u1:ws:worker:game", 5)
        ttl_before = await redis.ttl("player:u1:ws:worker:game")
        assert ttl_before <= 5

        await bridge.refresh_ttl("u1")
        ttl_after = await redis.ttl("player:u1:ws:worker:game")
        # After refresh it should be back up to ~90 s
        assert ttl_after > 5


# ---------------------------------------------------------------------------
# is_user_connected
# ---------------------------------------------------------------------------

class TestIsUserConnected:
    async def test_locally_registered_is_connected(self, bridge):
        await bridge.register("u1", make_ws())
        assert await bridge.is_user_connected("u1")

    async def test_redis_only_is_connected(self, bridge, redis):
        """A user whose key lives in Redis (another worker) should be seen as connected."""
        await redis.set("player:u2:ws:worker:game", "other-worker", ex=90)
        assert await bridge.is_user_connected("u2")

    async def test_unregistered_is_not_connected(self, bridge):
        assert not await bridge.is_user_connected("ghost")

    async def test_after_unregister_not_connected(self, bridge):
        await bridge.register("u1", make_ws())
        await bridge.unregister("u1")
        assert not await bridge.is_user_connected("u1")


# ---------------------------------------------------------------------------
# send_to_user — local fast-path
# ---------------------------------------------------------------------------

class TestSendToUserLocal:
    async def test_local_send_calls_send_json(self, bridge):
        ws = make_ws()
        await bridge.register("u1", ws)
        result = await bridge.send_to_user("u1", {"type": "test"})
        ws.send_json.assert_awaited_once_with({"type": "test"})
        assert result is True

    async def test_local_send_failure_removes_socket(self, bridge):
        ws = make_ws()
        ws.send_json = AsyncMock(side_effect=RuntimeError("connection closed"))
        await bridge.register("u1", ws)

        result = await bridge.send_to_user("u1", {"type": "test"})
        assert result is False
        assert bridge.get_local_websocket("u1") is None

    async def test_local_send_does_not_publish_to_redis(self, bridge, redis):
        """Local sends should never hit Redis Pub/Sub."""
        ws = make_ws()
        await bridge.register("u1", ws)

        # Patch redis.publish to detect any calls
        redis.publish = AsyncMock()
        await bridge.send_to_user("u1", {"type": "test"})
        redis.publish.assert_not_awaited()


# ---------------------------------------------------------------------------
# send_to_user — remote Pub/Sub path
# ---------------------------------------------------------------------------

class TestSendToUserRemote:
    async def test_remote_send_publishes_to_correct_channel(self, bridge, redis):
        """When a user is on another worker, the message is published to that worker's channel."""
        await redis.set("player:u2:ws:worker:game", "other-worker", ex=90)
        redis.publish = AsyncMock(return_value=1)

        result = await bridge.send_to_user("u2", {"type": "hello"})

        assert result is True
        redis.publish.assert_awaited_once()
        channel, payload_raw = redis.publish.call_args.args
        assert channel == "ws:worker:other-worker"
        payload = json.loads(payload_raw)
        assert payload["user_id"] == "u2"
        assert payload["message"] == {"type": "hello"}

    async def test_remote_send_returns_false_when_no_worker(self, bridge):
        """If no Redis key exists for the user, send_to_user should return False."""
        result = await bridge.send_to_user("ghost", {"type": "hi"})
        assert result is False

    async def test_no_local_socket_but_redis_key_routes_remotely(self, bridge, redis):
        """Explicit check: user not in _local but has a Redis worker key → publish path."""
        await redis.set("player:u3:ws:worker:game", "worker-B", ex=90)
        redis.publish = AsyncMock(return_value=1)

        # u3 is NOT in bridge._local
        assert bridge.get_local_websocket("u3") is None
        result = await bridge.send_to_user("u3", {"type": "routed"})
        assert result is True
        redis.publish.assert_awaited_once()


# ---------------------------------------------------------------------------
# get_local_websocket
# ---------------------------------------------------------------------------

class TestGetLocalWebsocket:
    async def test_returns_registered_socket(self, bridge):
        ws = make_ws()
        await bridge.register("u1", ws)
        assert bridge.get_local_websocket("u1") is ws

    async def test_returns_none_for_unknown(self, bridge):
        assert bridge.get_local_websocket("nobody") is None

    async def test_returns_none_after_unregister(self, bridge):
        ws = make_ws()
        await bridge.register("u1", ws)
        await bridge.unregister("u1")
        assert bridge.get_local_websocket("u1") is None
