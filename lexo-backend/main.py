from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from contextlib import asynccontextmanager
import os
import logging
from api.websocket import router as websocket_router
from api.lobby import router as lobby_router
from api.practice import router as practice_router
from game.stats_routes import router as stats_router
from core.exceptions import (
    LexoException, 
    lexo_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    http_exception_handler,
    general_exception_handler
)
try:
    from auth.routes import router as auth_router
    auth_available = True
except ImportError as e:
    logging.warning(f"Authentication module not available: {e}")
    auth_available = False
    
from game.word_list import load_wordlist
from core.database import Base, engine
from game.models_db import RoomDB, PlayerDB
from game.stats_models import UserStats, GameHistory, WordHistory
try:
    from auth.models import UserDB
except ImportError:
    pass
    
from core.rate_limiting import rate_limit_middleware
from core.security import SecurityHeaders
from game.manager import connection_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("lexo.log"),
        logging.StreamHandler()
    ]
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Application starting up...")
    try:
        Base.metadata.create_all(bind=engine)
        logging.info("Database tables created/verified.")
        
        load_wordlist()
        logging.info("Word list loaded successfully.")
        
        logging.info("Startup complete.")
    except Exception as e:
        logging.error(f"Startup failed: {e}")
        raise
    
    yield
    
    logging.info("Application shutting down...")
    for task in connection_manager.cleanup_tasks.values():
        if not task.done():
            task.cancel()
    logging.info("Shutdown complete.")

app = FastAPI(
    title="Lexo Word Game API",
    description="A multiplayer word game API",
    version="1.0.0",
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None,
    lifespan=lifespan
)

app.add_exception_handler(LexoException, lexo_exception_handler)  # type: ignore
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)  # type: ignore
app.add_exception_handler(Exception, general_exception_handler)  # type: ignore

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(SecurityHeaders.add_security_headers)

if os.getenv("ENVIRONMENT") == "production":
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["lexo-a4ba.onrender.com", "lexo-frontend.onrender.com"]
    )

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://lexo-frontend.onrender.com,https://lexo-a4ba.onrender.com").split(",")

origins = [origin.strip() for origin in allowed_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

if auth_available:
    app.include_router(stats_router, prefix="/api", tags=["Statistics"])
    app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"]) # type: ignore
app.include_router(lobby_router, prefix="/api", tags=["Lobby"])
app.include_router(websocket_router, prefix="/api", tags=["Game"])
app.include_router(practice_router, prefix="/api", tags=["Practice"])

@app.get("/", tags=["Health Check"])
async def read_root():
    return {"status": "ok", "message": "Welcome to the Word Game API!"}

@app.get("/health", tags=["Health Check"])
async def health_check():
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logging.error(f"Database health check failed: {e}")
        db_status = "error"
    
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "active_rooms": len(connection_manager.active_connections),
        "db_status": db_status,
        "total_connections": sum(len(room_conns) for room_conns in connection_manager.active_connections.values()),
        "auth_available": auth_available
    }