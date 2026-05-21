from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.services.daily_challenge_service import DailyChallengeService
from app.services.user_service import UserService
from app.api.dependencies.auth import AuthenticatedUser, get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


class SubmitDailyChallengeRequest(BaseModel):
    words: List[str]
    score: int


@router.get("/daily-challenge", response_model=dict)
async def get_daily_challenge(
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Return today's letter pool and the calling user's entry for today (if any).
    Also includes the top-10 leaderboard for today.
    """
    try:
        user_service = UserService(db)
        user = await user_service.get_user_by_supabase_id(current_user["user_id"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        service = DailyChallengeService(db)
        state = await service.get_challenge_state(user.id)
        return {"success": True, **state}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting daily challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/daily-challenge/submit", response_model=dict)
async def submit_daily_challenge(
    request: SubmitDailyChallengeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Submit the user's daily challenge result.
    Returns 409 if the user has already submitted today.
    """
    try:
        user_service = UserService(db)
        user = await user_service.get_user_by_supabase_id(current_user["user_id"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        service = DailyChallengeService(db)
        result = await service.submit(user.id, request.words, request.score)
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting daily challenge: {e}")
        raise HTTPException(status_code=500, detail=str(e))
