import redis.asyncio as aioredis
from typing import Optional
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_redis: Optional[aioredis.Redis] = None


async def init_redis() -> aioredis.Redis:
    global _redis
    from urllib.parse import urlparse

    url = settings.redis.url
    kwargs: dict = {
        "encoding": "utf-8",
        "decode_responses": True,
        "max_connections": settings.redis.max_connections,
    }
    # Upstash (and other hosted Redis) use TLS (rediss://) and self-signed or
    # intermediate certs that may not be in the default trust store on Render.
    # Disabling cert verification is safe here — traffic is still encrypted.
    if url.startswith("rediss://"):
        kwargs["ssl_cert_reqs"] = None

    _redis = aioredis.from_url(url, **kwargs)
    await _redis.ping()
    # Log host only — URL contains credentials
    host = urlparse(url).hostname or "unknown"
    logger.info(f"Redis connected: {host}")
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
