from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from datetime import datetime
import json

from app.models.database import GameHistory
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class GameRepository(BaseRepository[GameHistory]):
    
    def __init__(self, db: Session):
        super().__init__(GameHistory, db)
    
    def get_by_room_id(self, room_id: str) -> Optional[GameHistory]:
        return self.db.query(GameHistory).filter(GameHistory.room_id == room_id).first()
    
    def get_user_games(self, user_id: int, limit: int = 10) -> List[GameHistory]:
        games = self.db.query(GameHistory).filter(
            or_(
                GameHistory.player1_id == user_id,
                GameHistory.player2_id == user_id
            )
        ).order_by(desc(GameHistory.ended_at)).limit(limit).all()
        
        return games
    
    def create_game(
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
        game = GameHistory(
            room_id=room_id,
            player1_id=player1_id,
            player2_id=player2_id,
            player1_score=player1_score,
            player2_score=player2_score,
            player1_words=json.dumps(player1_words),
            player2_words=json.dumps(player2_words),
            winner_id=winner_id,
            duration=duration,
            letter_pool=','.join(letter_pool),
            started_at=started_at,
            ended_at=ended_at
        )
        
        created_game = self.create(game)
        logger.info(f"Created game history for room: {room_id}")
        return created_game
    
    def get_recent_games(self, limit: int = 100) -> List[GameHistory]:
        return self.db.query(GameHistory).order_by(
            desc(GameHistory.ended_at)
        ).limit(limit).all()
