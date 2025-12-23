from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any, Dict, Optional


@dataclass
class _CacheEntry:
    expires_at: float
    value: Any


_cache: Dict[str, _CacheEntry] = {}
_lock = Lock()


def cache_get(key: str) -> Optional[Any]:
    now = monotonic()
    with _lock:
        entry = _cache.get(key)
        if not entry:
            return None
        if entry.expires_at <= now:
            _cache.pop(key, None)
            return None
        return entry.value


def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    expires_at = monotonic() + ttl_seconds
    with _lock:
        _cache[key] = _CacheEntry(expires_at=expires_at, value=value)


def cache_invalidate(key: str) -> None:
    with _lock:
        _cache.pop(key, None)


def cache_invalidate_prefix(prefix: str) -> None:
    with _lock:
        keys = [key for key in _cache if key.startswith(prefix)]
        for key in keys:
            _cache.pop(key, None)
