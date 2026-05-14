from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.models.database import UserStats, User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class StatsRepository(BaseRepository[UserStats]):

    def __init__(self, db: AsyncSession):
        super().__init__(UserStats, db)

    async def get_by_user_id(self, user_id: int, with_user: bool = False) -> Optional[UserStats]:
        stmt = select(UserStats).where(UserStats.user_id == user_id)
        if with_user:
            stmt = stmt.options(selectinload(UserStats.user))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_for_user(self, user_id: int) -> UserStats:
        stats = UserStats(user_id=user_id)
        return await self.create(stats)

    async def get_or_create(self, user_id: int) -> UserStats:
        stats = await self.get_by_user_id(user_id)
        if not stats:
            stats = await self.create_for_user(user_id)
        return stats

    async def update_after_game(
        self,
        user_id: int,
        score: int,
        words: List[str],
        won: bool,
        tied: bool,
        game_duration: int
    ) -> UserStats:
        stats = await self.get_or_create(user_id)

        stats.total_games += 1
        if won:
            stats.wins += 1
            stats.current_win_streak += 1
            if stats.current_win_streak > stats.best_win_streak:
                stats.best_win_streak = stats.current_win_streak
        elif tied:
            stats.ties += 1
            stats.current_win_streak = 0
        else:
            stats.losses += 1
            stats.current_win_streak = 0

        stats.total_score += score
        if score > stats.highest_score:
            stats.highest_score = score
        stats.average_score = stats.total_score / stats.total_games

        stats.total_words += len(words)
        for word in words:
            if len(word) > stats.longest_word_length:
                stats.longest_word = word
                stats.longest_word_length = len(word)

        stats.total_play_time += game_duration
        stats.last_updated = datetime.utcnow()

        updated_stats = await self.update(stats)
        logger.info(f"Updated stats for user {user_id}: total_games={stats.total_games}, wins={stats.wins}")
        return updated_stats

    async def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        stmt = (
            select(UserStats, User)
            .join(User)
            .order_by(desc(UserStats.wins), desc(UserStats.highest_score))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        leaderboard = []
        for stat, user in rows:
            leaderboard.append({
                'username': user.username,
                'total_games': stat.total_games,
                'wins': stat.wins,
                'losses': stat.losses,
                'ties': stat.ties,
                'win_rate': stat.win_rate,
                'highest_score': stat.highest_score,
                'average_score': round(stat.average_score, 2),
                'total_words': stat.total_words,
                'longest_word': stat.longest_word,
                'best_win_streak': stat.best_win_streak
            })

        return leaderboard

    async def get_user_rank(self, user_id: int) -> Optional[int]:
        stats = await self.get_by_user_id(user_id)
        if not stats:
            return None

        stmt = select(func.count(UserStats.id)).where(
            (UserStats.wins > stats.wins) |
            ((UserStats.wins == stats.wins) & (UserStats.highest_score > stats.highest_score))
        )
        result = await self.db.execute(stmt)
        rank = result.scalar()
        return rank + 1

    async def delete_by_user_id(self, user_id: int) -> bool:
        stats = await self.get_by_user_id(user_id)
        if stats:
            await self.db.delete(stats)
            await self.db.commit()
            logger.info(f"Deleted stats for user: {user_id}")
            return True
        return False
