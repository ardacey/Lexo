import redis.asyncio as aioredis

from app.services.word_service import WordService
from app.services.game_service import GameService
from app.services.matchmaking_service import MatchmakingService
from app.services.presence_service import PresenceService
from app.services.ws_bridge import WebSocketBridge
from app.core.logging import get_logger

logger = get_logger(__name__)

_word_service: WordService = None
_game_service: GameService = None
_matchmaking_service: MatchmakingService = None
_presence_service: PresenceService = None
_bridge: WebSocketBridge = None


def init_services(redis: aioredis.Redis, bridge: WebSocketBridge):
    global _word_service, _game_service, _matchmaking_service, _presence_service, _bridge

    _word_service = WordService()
    _game_service = GameService(_word_service)
    _matchmaking_service = MatchmakingService(_game_service, redis)
    _presence_service = PresenceService()
    _bridge = bridge

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


def get_presence_service() -> PresenceService:
    if _presence_service is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _presence_service


def get_bridge() -> WebSocketBridge:
    if _bridge is None:
        raise RuntimeError("Services not initialized. Call init_services() first.")
    return _bridge
