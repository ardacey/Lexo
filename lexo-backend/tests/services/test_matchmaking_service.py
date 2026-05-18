"""
Tests for MatchmakingService (Redis-backed).

Uses fakeredis so no Redis server is required.
The Lua-based try_match_players is tested via a manual redis.eval mock
because the base `fakeredis` package does not ship with the Lua runtime.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import fakeredis.aioredis as fakeredis

from app.services.game_service import GameService
from app.services.matchmaking_service import MatchmakingService
from app.services.word_service import WordService
from app.models.domain import Player, GameRoom


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def redis():
    r = fakeredis.FakeRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest.fixture
def game_service():
    svc = MagicMock(spec=GameService)

    def _create_room(room_id, p1, p2, *_, **__):
        room = GameRoom(room_id, p1, p2)
        room.letter_pool = list("ABCDEFGHIJKLMNOP")
        return room

    svc.create_game_room.side_effect = _create_room
    return svc


@pytest.fixture
async def mm(redis, game_service):
    svc = MatchmakingService(game_service, redis)
    svc.worker_id = "test-worker-1"
    return svc


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

class TestQueue:
    async def test_add_to_queue_increments_depth(self, mm):
        depth = await mm.add_to_queue("u1", "Alice")
        assert depth == 1

    async def test_add_two_players(self, mm):
        await mm.add_to_queue("u1", "Alice")
        depth = await mm.add_to_queue("u2", "Bob")
        assert depth == 2

    async def test_add_duplicate_replaces_entry(self, mm):
        await mm.add_to_queue("u1", "Alice")
        await mm.add_to_queue("u1", "Alice")   # duplicate
        depth = await mm.get_queue_depth()
        assert depth == 1

    async def test_remove_from_queue(self, mm):
        await mm.add_to_queue("u1", "Alice")
        await mm.add_to_queue("u2", "Bob")
        await mm.remove_from_queue_by_id("u1")
        assert not await mm.is_in_queue("u1")
        assert await mm.is_in_queue("u2")

    async def test_is_in_queue_false_when_absent(self, mm):
        assert not await mm.is_in_queue("nobody")

    async def test_queue_depth(self, mm):
        for i in range(5):
            await mm.add_to_queue(f"u{i}", f"User{i}")
        assert await mm.get_queue_depth() == 5


# ---------------------------------------------------------------------------
# try_match_players  (Lua path — mocked)
# ---------------------------------------------------------------------------

class TestMatchPlayers:
    async def test_returns_none_when_empty(self, mm, redis):
        """Simulates eval returning nil (empty queue)."""
        redis.eval = AsyncMock(return_value=None)
        room = await mm.try_match_players()
        assert room is None

    async def test_creates_room_on_match(self, mm, redis):
        """Simulates eval returning two serialised players."""
        p1_json = json.dumps({"id": "u1", "username": "Alice"}).encode()
        p2_json = json.dumps({"id": "u2", "username": "Bob"}).encode()
        redis.eval = AsyncMock(return_value=[p1_json, p2_json])

        room = await mm.try_match_players()

        assert room is not None
        assert room.player1.id == "u1"
        assert room.player2.id == "u2"
        assert room.id in mm.active_rooms

    async def test_room_registered_in_redis(self, mm, redis):
        """After a match the room worker key should exist in Redis."""
        p1_json = json.dumps({"id": "u1", "username": "Alice"}).encode()
        p2_json = json.dumps({"id": "u2", "username": "Bob"}).encode()
        redis.eval = AsyncMock(return_value=[p1_json, p2_json])

        room = await mm.try_match_players()

        worker_key = await redis.get(f"mm:room:{room.id}:worker")
        assert worker_key == "test-worker-1"


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------

class TestRooms:
    async def _make_room(self, mm):
        return await mm.create_room("u1", "Alice", "u2", "Bob")

    async def test_create_room(self, mm):
        room = await self._make_room(mm)
        assert room is not None
        assert room.player1.username == "Alice"
        assert room.player2.username == "Bob"

    async def test_get_room_local(self, mm):
        room = await self._make_room(mm)
        assert mm.get_room(room.id) is room

    async def test_get_room_by_player(self, mm):
        room = await self._make_room(mm)
        assert mm.get_room_by_player("u1") is room
        assert mm.get_room_by_player("u2") is room

    async def test_get_room_by_player_unknown(self, mm):
        assert mm.get_room_by_player("nobody") is None

    async def test_room_id_in_redis(self, mm, redis):
        room = await self._make_room(mm)
        val = await redis.get(f"mm:player:u1:room")
        assert val == room.id

    async def test_is_player_busy(self, mm):
        await self._make_room(mm)
        assert await mm.is_player_busy("u1")
        assert not await mm.is_player_busy("stranger")

    async def test_cleanup_room(self, mm, redis):
        room = await self._make_room(mm)
        await mm.cleanup_room(room.id)

        assert mm.get_room(room.id) is None
        assert mm.get_room_by_player("u1") is None
        assert not await redis.exists(f"mm:player:u1:room")
        assert not await redis.exists(f"mm:room:{room.id}")

    async def test_snapshot_readable(self, mm):
        room = await self._make_room(mm)
        snap = await mm.get_room_snapshot(room.id)
        assert snap is not None
        assert snap["player1_id"] == "u1"
        assert snap["player2_id"] == "u2"


# ---------------------------------------------------------------------------
# Friend invites
# ---------------------------------------------------------------------------

class TestFriendInvites:
    async def test_create_and_get_invite(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        assert invite["invite_id"]
        assert invite["inviter_id"] == "u1"
        assert invite["target_id"] == "u2"
        assert invite["status"] == "pending"

    async def test_get_nonexistent_invite(self, mm):
        assert await mm.get_invite("nonexistent") is None

    async def test_duplicate_invite_raises(self, mm):
        await mm.create_invite("u1", "Alice", "u2", "Bob")
        with pytest.raises(ValueError):
            await mm.create_invite("u1", "Alice", "u3", "Carol")

    async def test_pop_invite_removes_keys(self, mm, redis):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        invite_id = invite["invite_id"]

        popped = await mm.pop_invite(invite_id)
        assert popped["invite_id"] == invite_id
        assert await mm.get_invite(invite_id) is None
        assert not await redis.exists(f"mm:user_invite:u1")
        assert not await redis.exists(f"mm:user_invite:u2")

    async def test_pop_nonexistent_returns_none(self, mm):
        assert await mm.pop_invite("ghost") is None

    async def test_set_invite_status_accepted(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        updated = await mm.set_invite_status(invite["invite_id"], "accepted")
        assert updated["status"] == "accepted"

    async def test_set_invite_status_declined_pops(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        invite_id = invite["invite_id"]
        await mm.set_invite_status(invite_id, "declined")
        assert await mm.get_invite(invite_id) is None

    async def test_cancel_invite_by_inviter(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        invite_id = invite["invite_id"]

        cancelled = await mm.cancel_invite_by_inviter("u1")
        assert cancelled["invite_id"] == invite_id
        assert await mm.get_invite(invite_id) is None

    async def test_cancel_invite_wrong_inviter(self, mm):
        await mm.create_invite("u1", "Alice", "u2", "Bob")
        result = await mm.cancel_invite_by_inviter("u2")   # not the inviter
        assert result is None

    async def test_get_active_invite_for_target(self, mm):
        await mm.create_invite("u1", "Alice", "u2", "Bob")
        active = await mm.get_active_invite_for_user("u2")
        assert active is not None
        assert active["inviter_id"] == "u1"

    async def test_get_active_invite_inviter_returns_none(self, mm):
        """Inviter should not see their own invite via get_active_invite_for_user."""
        await mm.create_invite("u1", "Alice", "u2", "Bob")
        assert await mm.get_active_invite_for_user("u1") is None

    async def test_mark_invite_join_creates_room_when_both_joined(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        invite_id = invite["invite_id"]
        await mm.set_invite_status(invite_id, "accepted")

        await mm.mark_invite_join(invite_id, "u1", "Alice")
        room = await mm.mark_invite_join(invite_id, "u2", "Bob")

        assert room is not None
        assert room.player1.id == "u1"
        assert room.player2.id == "u2"
        # Invite should be popped after room creation
        assert await mm.get_invite(invite_id) is None

    async def test_mark_invite_join_waits_for_second_player(self, mm):
        invite = await mm.create_invite("u1", "Alice", "u2", "Bob")
        invite_id = invite["invite_id"]
        await mm.set_invite_status(invite_id, "accepted")

        room = await mm.mark_invite_join(invite_id, "u1", "Alice")
        assert room is None   # only one player joined so far
