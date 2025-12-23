from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.services.stats_service import StatsService
from app.database.session import get_db
from app.core.logging import get_logger
from app.core.cache import cache_get, cache_set
from app.api.dependencies.auth import AuthenticatedUser, get_current_user

logger = get_logger(__name__)

router = APIRouter()


@router.get("/leaderboard", response_model=dict)
def get_leaderboard(
    limit: int = 100,
    db: Session = Depends(get_db),
    _current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        cache_key = f"leaderboard:{limit}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        stats_service = StatsService(db)
        leaderboard = stats_service.get_leaderboard(limit)

        response = {
            "success": True,
            "leaderboard": leaderboard
        }
        cache_set(cache_key, response, ttl_seconds=30)
        return response
    except Exception as e:
        logger.error(f"Error getting leaderboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
