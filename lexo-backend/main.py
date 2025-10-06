from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config import API_SETTINGS, LOG_LEVEL
from services import WordService, GameService, MatchmakingService
from routes import create_websocket_router, api_router

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=API_SETTINGS['title'],
    version=API_SETTINGS['version'],
    description="A multiplayer word game backend with WebSocket support"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=API_SETTINGS['cors_origins'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

word_service = WordService()
game_service = GameService(word_service)
matchmaking_service = MatchmakingService(game_service)

logger.info("Services initialized successfully")


# Dependency injection for routes
def get_word_service():
    return word_service


def get_matchmaking_service():
    return matchmaking_service


ws_router = create_websocket_router(matchmaking_service, word_service)
app.include_router(ws_router)

# Single player API routes
from routes import setup_api_routes
api_router_configured = setup_api_routes(word_service)
app.include_router(api_router_configured)

@app.get("/")
def read_root():
    stats = matchmaking_service.get_stats()
    return {
        "message": "Lexo Multiplayer API",
        "status": "running",
        "active_rooms": stats['active_rooms'],
        "waiting_players": stats['waiting_players']
    }


@app.get("/stats")
def get_stats():
    stats = matchmaking_service.get_stats()
    return {
        "active_rooms": stats['active_rooms'],
        "waiting_players": stats['waiting_players'],
        "total_words": word_service.get_word_count()
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# Application startup event
@app.on_event("startup")
async def startup_event():
    logger.info(f"Starting {API_SETTINGS['title']} v{API_SETTINGS['version']}")
    logger.info(f"Loaded {word_service.get_word_count()} valid Turkish words")


# Application shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Lexo Multiplayer API")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=API_SETTINGS['host'],
        port=API_SETTINGS['port'],
        log_level=LOG_LEVEL.lower()
    )
