import time
import redis.asyncio as aioredis
from typing import List

# Sorted-set key: score = unix timestamp of last ping
_PRESENCE_KEY = "presence:active"


class PresenceService:
    """
    Redis-backed presence tracking.
    Uses a sorted set where every member is a user_id and the score is the
    Unix timestamp of their last ping.  Entries older than `ttl_seconds` are
    considered offline and are lazily pruned on every read.
    """

    def __init__(self, redis: aioredis.Redis, ttl_seconds: int = 12):
        self.redis = redis
        self.ttl = ttl_seconds

    async def mark_online(self, user_id: str) -> None:
        now = time.time()
        await self.redis.zadd(_PRESENCE_KEY, {user_id: now})

    async def get_online_count(self) -> int:
        cutoff = time.time() - self.ttl
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(_PRESENCE_KEY, "-inf", cutoff)
        pipe.zcard(_PRESENCE_KEY)
        results = await pipe.execute()
        return results[1]

    async def get_online_user_ids(self, user_ids: List[str]) -> List[str]:
        if not user_ids:
            return []
        cutoff = time.time() - self.ttl
        # Pipeline zscore queries for all requested user ids
        pipe = self.redis.pipeline()
        for uid in user_ids:
            pipe.zscore(_PRESENCE_KEY, uid)
        scores = await pipe.execute()
        return [uid for uid, score in zip(user_ids, scores) if score is not None and score > cutoff]
