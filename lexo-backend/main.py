from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import asyncio
from api.websocket import router as websocket_router
from api.lobby import router as lobby_router
from game.word_list import load_wordlist
from core.database import Base, engine
from game.models_db import RoomDB, PlayerDB

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
async def on_startup():
    print("Application starting up...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created/verified.")
    
    load_wordlist()
    print("Wordlist loaded.")
    
    try:
        from core.redis_client import redis_client, message_broker
        redis_client.ping()
        print("Redis connection successful.")
        asyncio.create_task(message_broker.listen_for_messages())
        print("Redis message broker started.")
    except Exception as e:
        print(f"Redis connection failed: {e}")
        print("Application will continue without Redis.")
    
    print("Startup complete.")

app.include_router(lobby_router, prefix="/api", tags=["Lobby"])
app.include_router(websocket_router, prefix="/api", tags=["Game"])

@app.get("/", tags=["Health Check"])
async def read_root():
    return {"status": "ok", "message": "Welcome to the Word Game API!"}