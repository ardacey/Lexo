from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import LexoException
from app.core.cache import cache
from app.database.session import init_db
from app.dependencies import (
    init_services, 
    get_word_service,
    get_matchmaking_service
)
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import router as health_router
from app.websocket.game_handler import GameWebSocketHandler
from app.middleware.error_handler import (
    lexo_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    general_exception_handler
)
from app.middleware.timing import RequestTimingMiddleware

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.api.title} v{settings.api.version}")

    try:
        init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        raise

    try:
        cache.connect()
        if cache.enabled:
            logger.info("✅ Redis cache connected successfully")
        else:
            logger.warning("⚠️  Redis cache disabled, running without cache")
    except Exception as e:
        logger.warning(f"⚠️  Redis connection failed: {e}. Continuing without cache...")

    try:
        init_services()
        word_service = get_word_service()
        logger.info(f"✅ Loaded {word_service.get_word_count()} valid Turkish words")
    except Exception as e:
        logger.error(f"❌ Service initialization failed: {e}")
        raise
    
    logger.info("🚀 Application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    cache.disconnect()
    logger.info("Application shutdown complete")
    
    logger.info("Shutting down Lexo Multiplayer API")


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

# Add request timing middleware
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
    
    handler = GameWebSocketHandler(matchmaking_service, word_service)
    await handler.handle_connection(websocket)


@app.get("/")
def read_root():
    matchmaking_service = get_matchmaking_service()
    stats = matchmaking_service.get_stats()
    
    return {
        "message": "Lexo Multiplayer API",
        "version": settings.api.version,
        "status": "running",
        "active_rooms": stats['active_rooms'],
        "waiting_players": stats['waiting_players']
    }


@app.get("/stats")
def get_stats():
    matchmaking_service = get_matchmaking_service()
    word_service = get_word_service()
    stats = matchmaking_service.get_stats()
    
    return {
        "active_rooms": stats['active_rooms'],
        "waiting_players": stats['waiting_players'],
        "total_words": word_service.get_word_count()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=settings.api.host,
        port=settings.api.port,
        log_level=settings.log.level.lower()
    )
