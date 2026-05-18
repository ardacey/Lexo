"""
Tests for PresenceService (Redis sorted-set backed).

Uses fakeredis so no real Redis server is required.
time.time() is patched to control the clock and exercise TTL filtering.
"""
import pytest
from unittest.mock import patch

import fakeredis.aioredis as fakeredis

from app.services.presence_service import PresenceService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def redis():
    r = fakeredis.FakeRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest.fixture
def ps(redis):
    # 10-second TTL so tests can use small numeric offsets
    return PresenceService(redis, ttl_seconds=10)


# ---------------------------------------------------------------------------
# mark_online
# ---------------------------------------------------------------------------

class TestMarkOnline:
    async def test_mark_online_stores_entry(self, ps, redis):
        """mark_online should write an entry to the sorted set."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")

        score = await redis.zscore("presence:active", "u1")
        assert score == pytest.approx(1_000.0)

    async def test_mark_online_updates_existing_score(self, ps, redis):
        """Calling mark_online twice should update the score to the latest timestamp."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")
        with patch("app.services.presence_service.time.time", return_value=1_005.0):
            await ps.mark_online("u1")

        score = await redis.zscore("presence:active", "u1")
        assert score == pytest.approx(1_005.0)

    async def test_mark_online_multiple_users(self, ps, redis):
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")
            await ps.mark_online("u2")
            await ps.mark_online("u3")

        count = await redis.zcard("presence:active")
        assert count == 3


# ---------------------------------------------------------------------------
# get_online_count
# ---------------------------------------------------------------------------

class TestGetOnlineCount:
    async def test_empty_returns_zero(self, ps):
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            count = await ps.get_online_count()
        assert count == 0

    async def test_fresh_users_counted(self, ps):
        """Users pinged recently should all be counted."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")
            await ps.mark_online("u2")

        # Query 5 s later — both are within the 10-second TTL
        with patch("app.services.presence_service.time.time", return_value=1_005.0):
            count = await ps.get_online_count()
        assert count == 2

    async def test_expired_users_pruned(self, ps):
        """Users older than TTL should not be counted."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")

        # Query 11 s later — entry is beyond the 10-second TTL
        with patch("app.services.presence_service.time.time", return_value=1_011.0):
            count = await ps.get_online_count()
        assert count == 0

    async def test_mixed_fresh_and_stale(self, ps):
        """Only fresh entries should be counted; stale ones should be pruned."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("old_user")

        with patch("app.services.presence_service.time.time", return_value=1_009.0):
            await ps.mark_online("new_user")

        # At t=1_011, old_user (score 1000) is stale, new_user (score 1009) is fresh
        with patch("app.services.presence_service.time.time", return_value=1_011.0):
            count = await ps.get_online_count()
        assert count == 1

    async def test_prune_removes_from_sorted_set(self, ps, redis):
        """After a call to get_online_count the stale entry should be gone."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("ghost")

        with patch("app.services.presence_service.time.time", return_value=1_015.0):
            await ps.get_online_count()

        # The key should have been removed by zremrangebyscore
        score = await redis.zscore("presence:active", "ghost")
        assert score is None

    async def test_exactly_at_boundary_is_stale(self, ps):
        """Score == cutoff means the user is NOT counted (score > cutoff required)."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("boundary_user")

        # Exactly 10 s later: cutoff = 1_000.0, score = 1_000.0 → stale
        with patch("app.services.presence_service.time.time", return_value=1_010.0):
            count = await ps.get_online_count()
        assert count == 0


# ---------------------------------------------------------------------------
# get_online_user_ids
# ---------------------------------------------------------------------------

class TestGetOnlineUserIds:
    async def test_empty_input_returns_empty(self, ps):
        result = await ps.get_online_user_ids([])
        assert result == []

    async def test_all_fresh_returned(self, ps):
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")
            await ps.mark_online("u2")

        with patch("app.services.presence_service.time.time", return_value=1_005.0):
            result = await ps.get_online_user_ids(["u1", "u2"])
        assert set(result) == {"u1", "u2"}

    async def test_expired_user_excluded(self, ps):
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("old")
        with patch("app.services.presence_service.time.time", return_value=1_008.0):
            await ps.mark_online("fresh")

        with patch("app.services.presence_service.time.time", return_value=1_012.0):
            result = await ps.get_online_user_ids(["old", "fresh"])
        assert result == ["fresh"]

    async def test_unknown_user_excluded(self, ps):
        """Users not in Redis at all should not appear in the result."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")

        with patch("app.services.presence_service.time.time", return_value=1_005.0):
            result = await ps.get_online_user_ids(["u1", "ghost", "nobody"])
        assert result == ["u1"]

    async def test_preserves_input_order(self, ps):
        """Result should follow the order of the input list."""
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            for uid in ("c", "a", "b"):
                await ps.mark_online(uid)

        with patch("app.services.presence_service.time.time", return_value=1_005.0):
            result = await ps.get_online_user_ids(["c", "a", "b"])
        assert result == ["c", "a", "b"]

    async def test_none_online_returns_empty(self, ps):
        with patch("app.services.presence_service.time.time", return_value=1_000.0):
            await ps.mark_online("u1")

        with patch("app.services.presence_service.time.time", return_value=1_015.0):
            result = await ps.get_online_user_ids(["u1"])
        assert result == []
