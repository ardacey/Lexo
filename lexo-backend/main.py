from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.websocket import router as websocket_router
from api.lobby import router as lobby_router
from game.word_list import load_wordlist

app = FastAPI(title="Word Game")

origins = [
    "http://localhost:5173",
    "https://lexo-a4ba.onrender.com"
]

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
    load_wordlist()
    print("Startup complete.")

app.include_router(lobby_router, prefix="/api", tags=["Lobby"])
app.include_router(websocket_router, prefix="/api", tags=["Game"])

@app.get("/", tags=["Health Check"])
async def read_root():
    return {"status": "ok", "message": "Welcome to the Word Game API!"}