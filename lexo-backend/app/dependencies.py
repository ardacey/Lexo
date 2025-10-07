from typing import Generator
from functools import lru_cache

from app.services.word_service import WordService
from app.services.game_service import GameService
from app.services.matchmaking_service import MatchmakingService
from app.core.logging import get_logger

logger = get_logger(__name__)

_word_service: WordService = None
_game_service: GameService = None
_matchmaking_service: MatchmakingService = None


def init_services():
    global _word_service, _game_service, _matchmaking_service
    
    _word_service = WordService()
    _game_service = GameService(_word_service)
    _matchmaking_service = MatchmakingService(_game_service)
    
    logger.info("Services initialized successfully")


def get_word_service() -> WordService:
    if _word_service is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _word_service


def get_game_service() -> GameService:
    if _game_service is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _game_service


def get_matchmaking_service() -> MatchmakingService:
    if _matchmaking_service is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _matchmaking_service
