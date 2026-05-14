from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.database import UserStats
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError
from app.core.cache import (
    cache_get,
    cache_set,
    cache_invalidate,
    cache_invalidate_prefix
)

logger = get_logger(__name__)


class StatsService:

    def __init__(self, db: AsyncSession):
        self.stats_repo = StatsRepository(db)

    async def get_user_stats(self, user_id: int) -> Optional[UserStats]:
        return await self.stats_repo.get_by_user_id(user_id)

    async def update_stats_after_game(
        self,
        user_id: int,
        score: int,
        words: List[str],
        won: bool,
        tied: bool,
        game_duration: int
    ) -> UserStats:
        try:
            return await self.stats_repo.update_after_game(
                user_id=user_id,
                score=score,
                words=words,
                won=won,
                tied=tied,
                game_duration=game_duration
            )
        except Exception as e:
            logger.error(f"Error updating stats for user {user_id}: {e}")
            raise DatabaseError(f"Failed to update stats: {str(e)}")
        finally:
            cache_invalidate(f"user_stats:{user_id}")
            cache_invalidate(f"user_rank:{user_id}")
            cache_invalidate_prefix("leaderboard:")

    async def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        return await self.stats_repo.get_leaderboard(limit)

    async def get_user_rank(self, user_id: int) -> Optional[int]:
        cache_key = f"user_rank:{user_id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached
        rank = await self.stats_repo.get_user_rank(user_id)
        cache_set(cache_key, rank, ttl_seconds=15)
        return rank
