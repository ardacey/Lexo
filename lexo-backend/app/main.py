from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager

import os
import sentry_sdk

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import LexoException
from app.core.redis import init_redis, close_redis
from app.database.session import init_db
from app.services.ws_bridge import WebSocketBridge
from app.dependencies import (
    init_services,
    get_word_service,
    get_matchmaking_service,
    get_presence_service,
    get_bridge,
)
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import router as health_router
from app.websocket.game_handler import GameWebSocketHandler
from app.websocket.notification_handler import NotificationWebSocketHandler
from app.middleware.error_handler import (
    lexo_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.middleware.timing import RequestTimingMiddleware

setup_logging()
logger = get_logger(__name__)

if settings.sentry.dsn:
    sentry_sdk.init(
        dsn=settings.sentry.dsn,
        traces_sample_rate=settings.sentry.traces_sample_rate,
        environment=os.environ.get('ENVIRONMENT', 'development'),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.api.title} v{settings.api.version}")

    try:
        await init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise

    env = os.environ.get('ENVIRONMENT', 'development')
    if env == 'production' and settings.api.cors_origins == ['*']:
        logger.error('CORS_ORIGINS is set to "*" in production. This is insecure.')
        raise RuntimeError('CORS_ORIGINS must be restricted in production')

    try:
        redis = await init_redis()
        logger.info("✅ Redis connected successfully")
    except Exception as e:
        logger.error(f"❌ Redis initialization failed: {e}")
        raise

    bridge = WebSocketBridge(redis)
    await bridge.start()
    logger.info("✅ WebSocketBridge started")

    try:
        init_services(redis, bridge)
        word_service = get_word_service()
        matchmaking_service = get_matchmaking_service()
        matchmaking_service.worker_id = bridge.worker_id
        logger.info(f"✅ Loaded {word_service.get_word_count()} valid Turkish words")
    except Exception as e:
        logger.error(f"❌ Service initialization failed: {e}")
        raise

    logger.info("🚀 Application started successfully")

    yield

    logger.info("Shutting down application...")
    await bridge.stop()
    await close_redis()
    logger.info("Application shutdown complete")


app = FastAPI(
    title=settings.api.title,
    version=settings.api.version,
    description="A modular multiplayer word game backend with WebSocket support",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestTimingMiddleware)

app.add_exception_handler(LexoException, lexo_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

app.include_router(api_router)
app.include_router(health_router, tags=["health"])


@app.websocket("/ws/queue")
async def websocket_queue_endpoint(websocket: WebSocket):
    matchmaking_service = get_matchmaking_service()
    word_service = get_word_service()
    bridge = get_bridge()
    handler = GameWebSocketHandler(matchmaking_service, word_service, bridge)
    await handler.handle_connection(websocket)


@app.websocket("/ws/notify")
async def websocket_notify_endpoint(websocket: WebSocket):
    matchmaking_service = get_matchmaking_service()
    bridge = get_bridge()
    handler = NotificationWebSocketHandler(matchmaking_service, bridge)
    await handler.handle_connection(websocket)


@app.get("/")
async def read_root():
    matchmaking_service = get_matchmaking_service()
    stats = matchmaking_service.get_stats()
    queue_depth = await matchmaking_service.get_queue_depth()
    return {
        "message": "Lexo Multiplayer API",
        "version": settings.api.version,
        "status": "running",
        "active_rooms": stats['active_rooms'],
        "waiting_players": queue_depth,
    }


@app.get("/stats")
async def get_stats():
    matchmaking_service = get_matchmaking_service()
    word_service = get_word_service()
    presence_service = get_presence_service()
    stats = matchmaking_service.get_stats()
    queue_depth = await matchmaking_service.get_queue_depth()
    return {
        "active_rooms": stats['active_rooms'],
        "waiting_players": queue_depth,
        "total_words": word_service.get_word_count(),
        "online_players": presence_service.get_online_count(),
    }


@app.get("/app/version")
def get_app_version():
    return {
        "min_version": settings.app.min_version,
        "latest_version": settings.app.latest_version,
        "update_url": settings.app.update_url,
        "force_update": settings.app.force_update
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api.host,
        port=settings.api.port,
        log_level=settings.log.level.lower()
    )
