from datetime import datetime, timedelta
from typing import Dict


class PresenceService:
    def __init__(self, ttl_seconds: int = 12):
        self.ttl = timedelta(seconds=ttl_seconds)
        self._last_seen: Dict[str, datetime] = {}

    def mark_online(self, user_id: str) -> None:
        self._last_seen[user_id] = datetime.utcnow()

    def cleanup(self) -> None:
        cutoff = datetime.utcnow() - self.ttl
        stale = [user_id for user_id, seen in self._last_seen.items() if seen < cutoff]
        for user_id in stale:
            self._last_seen.pop(user_id, None)

    def get_online_count(self) -> int:
        self.cleanup()
        return len(self._last_seen)

    def get_online_user_ids(self, user_ids: list[str]) -> list[str]:
        self.cleanup()
        return [user_id for user_id in user_ids if user_id in self._last_seen]
