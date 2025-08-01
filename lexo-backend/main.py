from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from api.websocket import router as websocket_router
from api.lobby import router as lobby_router
from api.practice import router as practice_router
try:
    from auth.routes import router as auth_router
    auth_available = True
except ImportError as e:
    print(f"Warning: Authentication module not available: {e}")
    auth_available = False
    
from game.word_list import load_wordlist
from core.database import Base, engine
from game.models_db import RoomDB, PlayerDB
try:
    from auth.models import UserDB
except ImportError:
    pass
    
from game.manager import connection_manager

app = FastAPI(title="Word Game")

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://lexo-frontend.onrender.com,https://lexo-a4ba.onrender.com").split(",")

origins = [origin.strip() for origin in allowed_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    print("Application starting up...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified.")
    
    load_wordlist()
    print("Startup complete.")

if auth_available:
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
    except Exception:
        db_status = "error"
    
    return {
        "status": "healthy",
        "active_rooms": len(connection_manager.active_connections),
        "db_status": db_status,
        "total_connections": sum(len(room_conns) for room_conns in connection_manager.active_connections.values())
    }