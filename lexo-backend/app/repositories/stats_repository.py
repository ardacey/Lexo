from typing import Optional, List, Dict
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, func
from datetime import datetime

from app.models.database import UserStats, User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class StatsRepository(BaseRepository[UserStats]):
    
    def __init__(self, db: Session):
        super().__init__(UserStats, db)
    
    def get_by_user_id(self, user_id: int, with_user: bool = False) -> Optional[UserStats]:
        """
        Get stats by user ID with optional eager loading of user data
        """
        query = self.db.query(UserStats).filter(UserStats.user_id == user_id)
        
        if with_user:
            query = query.options(joinedload(UserStats.user))
        
        stats = query.first()
        
        return stats
    
    def create_for_user(self, user_id: int) -> UserStats:
        stats = UserStats(user_id=user_id)
        return self.create(stats)
    
    def get_or_create(self, user_id: int) -> UserStats:
        stats = self.get_by_user_id(user_id)
        if not stats:
            stats = self.create_for_user(user_id)
        return stats
    
    def update_after_game(
        self,
        user_id: int,
        score: int,
        words: List[str],
        won: bool,
        tied: bool,
        game_duration: int
    ) -> UserStats:
        stats = self.get_or_create(user_id)
        
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
        
        updated_stats = self.update(stats)
        
        
        logger.info(
            f"Updated stats for user {user_id}: "
            f"total_games={stats.total_games}, wins={stats.wins}"
        )
        return updated_stats
    
    def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        """
        Get leaderboard with caching and optimized query (single join, eager loading)
        """
        # Optimized query with eager loading to avoid N+1
        results = (
            self.db.query(UserStats, User)
            .join(User)
            .order_by(desc(UserStats.wins), desc(UserStats.highest_score))
            .limit(limit)
            .all()
        )
        
        leaderboard = []
        for stat, user in results:
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
    
    def get_user_rank(self, user_id: int) -> Optional[int]:
        stats = self.get_by_user_id(user_id)
        if not stats:
            return None
        
        rank = self.db.query(func.count(UserStats.id)).filter(
            (UserStats.wins > stats.wins) |
            ((UserStats.wins == stats.wins) & (UserStats.highest_score > stats.highest_score))
        ).scalar()
        
        return rank + 1
