import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis: Optional[aioredis.Redis] = None


async def init_redis() -> aioredis.Redis:
    global _redis
    _redis = aioredis.from_url(
        settings.redis.url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=settings.redis.max_connections,
    )
    await _redis.ping()
    logger.info(f"Redis connected: {settings.redis.url}")
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis
