from fastapi import APIRouter

from app.api.v1.endpoints import words, users, games, leaderboard

api_router = APIRouter()

api_router.include_router(words.router, prefix="/api/v1/words", tags=["words"])
api_router.include_router(users.router, prefix="/api", tags=["users"])
api_router.include_router(games.router, prefix="/api", tags=["games"])
api_router.include_router(leaderboard.router, prefix="/api", tags=["leaderboard"])
