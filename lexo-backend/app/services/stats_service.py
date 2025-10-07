from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.models.database import UserStats
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError

logger = get_logger(__name__)


class StatsService:
    
    def __init__(self, db: Session):
        self.stats_repo = StatsRepository(db)
    
    def get_user_stats(self, user_id: int) -> Optional[UserStats]:
        return self.stats_repo.get_by_user_id(user_id)
    
    def update_stats_after_game(
        self,
        user_id: int,
        score: int,
        words: List[str],
        won: bool,
        tied: bool,
        game_duration: int
    ) -> UserStats:
        try:
            return self.stats_repo.update_after_game(
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
    
    def get_leaderboard(self, limit: int = 100) -> List[Dict]:
        return self.stats_repo.get_leaderboard(limit)
    
    def get_user_rank(self, user_id: int) -> Optional[int]:
        return self.stats_repo.get_user_rank(user_id)
