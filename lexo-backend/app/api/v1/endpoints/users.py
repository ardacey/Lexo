from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.schemas import CreateUserRequest, UpdateUsernameRequest, UserResponse, UserStatsResponse
from app.services.user_service import UserService
from app.services.stats_service import StatsService
from app.database.session import get_db
from app.core.logging import get_logger
from app.core.cache import cache_get, cache_set
from app.core.exceptions import DatabaseError, ValidationError
from app.api.dependencies.auth import AuthenticatedUser, get_current_user

logger = get_logger(__name__)

router = APIRouter()


@router.post("/users", response_model=dict)
def create_user(
    request: CreateUserRequest,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        if current_user["user_id"] != request.user_id:
            raise HTTPException(status_code=403, detail="Cannot create user for different user ID")

        user_service = UserService(db)
        stats_service = StatsService(db)
        
        user = user_service.create_or_get_user(
            request.user_id,
            request.username,
            request.email
        )
        stats = stats_service.get_user_stats(user.id)
        
        return {
            "success": True,
            "user": {
                "id": user.id,
                "user_id": user.supabase_user_id,
                "username": user.username,
                "email": user.email,
                "created_at": user.created_at.isoformat()
            },
            "stats": {
                "total_games": stats.total_games if stats else 0,
                "wins": stats.wins if stats else 0,
                "losses": stats.losses if stats else 0,
                "ties": stats.ties if stats else 0,
                "win_rate": stats.win_rate if stats else 0,
                "highest_score": stats.highest_score if stats else 0,
                "average_score": stats.average_score if stats else 0,
                "total_score": stats.total_score if stats else 0,
                "total_words": stats.total_words if stats else 0,
                "longest_word": stats.longest_word if stats else "",
                "longest_word_length": stats.longest_word_length if stats else 0,
                "total_play_time": stats.total_play_time if stats else 0,
                "current_win_streak": stats.current_win_streak if stats else 0,
                "best_win_streak": stats.best_win_streak if stats else 0
            }
        }
    except DatabaseError as e:
        logger.error(f"Database error creating user: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating/getting user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}/stats", response_model=dict)
def get_user_stats(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        if current_user["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        user_service = UserService(db)
        stats_service = StatsService(db)
        
        user = user_service.get_user_by_supabase_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cache_key = f"user_stats:{user.id}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        stats = stats_service.get_user_stats(user.id)
        rank = stats_service.get_user_rank(user.id)
        
        if not stats:
            response = {
                "success": True,
                "stats": {
                    "total_games": 0,
                    "wins": 0,
                    "losses": 0,
                    "ties": 0,
                    "win_rate": 0,
                    "highest_score": 0,
                    "average_score": 0,
                    "total_score": 0,
                    "total_words": 0,
                    "longest_word": "",
                    "longest_word_length": 0,
                    "total_play_time": 0,
                    "current_win_streak": 0,
                    "best_win_streak": 0,
                    "rank": None
                }
            }
            cache_set(cache_key, response, ttl_seconds=15)
            return response
        
        response = {
            "success": True,
            "stats": {
                "total_games": stats.total_games,
                "wins": stats.wins,
                "losses": stats.losses,
                "ties": stats.ties,
                "win_rate": round(stats.win_rate, 2),
                "highest_score": stats.highest_score,
                "average_score": round(stats.average_score, 2),
                "total_score": stats.total_score,
                "total_words": stats.total_words,
                "longest_word": stats.longest_word,
                "longest_word_length": stats.longest_word_length,
                "total_play_time": stats.total_play_time,
                "current_win_streak": stats.current_win_streak,
                "best_win_streak": stats.best_win_streak,
                "rank": rank
            }
        }
        cache_set(cache_key, response, ttl_seconds=15)
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/check-username/{username}")
def check_username_availability(username: str, db: Session = Depends(get_db)):
    """
    Check if a username is available for registration.
    Returns {"available": true/false}
    """
    try:
        user_service = UserService(db)
        # Check if username exists
        user = user_service.get_user_by_username(username)
        return {
            "available": user is None,
            "username": username
        }
    except Exception as e:
        logger.error(f"Error checking username availability: {e}")
        raise HTTPException(status_code=500, detail="Failed to check username availability")


@router.patch("/users/me/username", response_model=dict)
def update_username(
    request: UpdateUsernameRequest,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        user_service = UserService(db)
        user = user_service.update_username(current_user["user_id"], request.username)
        return {
            "success": True,
            "username": user.username
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabaseError as e:
        logger.error(f"Database error updating username for {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating username for {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/users/me")
def delete_user_account(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Delete the current user's account and all associated data.
    This action is irreversible.
    """
    try:
        user_service = UserService(db)
        success = user_service.delete_user(current_user["user_id"])
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": "Account and all associated data have been deleted successfully"
        }
    except DatabaseError as e:
        logger.error(f"Database error deleting user {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
    except Exception as e:
        logger.error(f"Error deleting user {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")


@router.delete("/users/me")
def delete_user_account(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Delete the current user's account and all associated data.
    This action is irreversible.
    """
    try:
        user_service = UserService(db)
        success = user_service.delete_user(current_user["user_id"])
        
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "success": True,
            "message": "Account and all associated data have been deleted successfully"
        }
    except DatabaseError as e:
        logger.error(f"Database error deleting user {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
    except Exception as e:
        logger.error(f"Error deleting user {current_user['user_id']}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
