from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import GameHistory
from app.repositories.game_repository import GameRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError
from app.core.cache import cache_invalidate_prefix

logger = get_logger(__name__)


class GameHistoryService:
    
    def __init__(self, db: Session):
        self.game_repo = GameRepository(db)
    
    def create_game_history(
        self,
        room_id: str,
        player1_id: int,
        player2_id: int,
        player1_score: int,
        player2_score: int,
        player1_words: List[str],
        player2_words: List[str],
        winner_id: Optional[int],
        duration: int,
        letter_pool: List[str],
        started_at: datetime,
        ended_at: datetime
    ) -> GameHistory:
        try:
            return self.game_repo.create_game(
                room_id=room_id,
                player1_id=player1_id,
                player2_id=player2_id,
                player1_score=player1_score,
                player2_score=player2_score,
                player1_words=player1_words,
                player2_words=player2_words,
                winner_id=winner_id,
                duration=duration,
                letter_pool=letter_pool,
                started_at=started_at,
                ended_at=ended_at
            )
        except Exception as e:
            logger.error(f"Error creating game history for room {room_id}: {e}")
            raise DatabaseError(f"Failed to create game history: {str(e)}")
        finally:
            cache_invalidate_prefix(f"user_games:{player1_id}:")
            cache_invalidate_prefix(f"user_games:{player2_id}:")
    
    def get_user_games(self, user_id: int, limit: int = 10) -> List[GameHistory]:
        return self.game_repo.get_user_games(user_id, limit)
    
    def get_game_by_room_id(self, room_id: str) -> Optional[GameHistory]:
        return self.game_repo.get_by_room_id(room_id)
