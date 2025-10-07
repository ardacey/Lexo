from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.schemas import SaveGameRequest, SaveGameResponse
from app.services.user_service import UserService
from app.services.stats_service import StatsService
from app.services.game_history_service import GameHistoryService
from app.database.session import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.get("/users/{clerk_id}/games", response_model=dict)
def get_user_games(
    clerk_id: str,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    try:
        user_service = UserService(db)
        game_history_service = GameHistoryService(db)
        
        user = user_service.get_user_by_clerk_id(clerk_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        games = game_history_service.get_user_games(user.id, limit)
        
        games_list = []
        for game in games:
            tied = game.winner_id is None
            
            won = False
            if not tied and game.winner_id:
                if game.winner_id == game.player1_id:
                    winner = game.player1
                else:
                    winner = game.player2
                won = winner.clerk_id == clerk_id
            
            opponent_id = game.player2_id if game.player1_id == user.id else game.player1_id
            opponent = user_service.get_user_by_id(opponent_id)
            
            if game.player1_id == user.id:
                user_score = game.player1_score
                opponent_score = game.player2_score
                user_words = game.player1_words
            else:
                user_score = game.player2_score
                opponent_score = game.player1_score
                user_words = game.player2_words
            
            games_list.append({
                "room_id": game.room_id,
                "opponent": opponent.username if opponent else "Unknown",
                "user_score": user_score,
                "opponent_score": opponent_score,
                "user_words": user_words,
                "won": won,
                "tied": tied,
                "duration": game.duration,
                "played_at": game.ended_at.isoformat()
            })
        
        return {
            "success": True,
            "games": games_list
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user games: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/games/save", response_model=SaveGameResponse)
def save_game(
    request: SaveGameRequest,
    db: Session = Depends(get_db)
):
    try:
        user_service = UserService(db)
        stats_service = StatsService(db)
        game_history_service = GameHistoryService(db)
        
        player1 = user_service.get_user_by_clerk_id(request.player1_clerk_id)
        player2 = user_service.get_user_by_clerk_id(request.player2_clerk_id)
        
        if not player1:
            raise HTTPException(status_code=404, detail="Player 1 not found")
        if not player2:
            raise HTTPException(status_code=404, detail="Player 2 not found")
        
        winner_id = None
        if request.winner_clerk_id:
            winner = user_service.get_user_by_clerk_id(request.winner_clerk_id)
            if winner:
                winner_id = winner.id
        
        started_at = datetime.fromisoformat(request.started_at.replace('Z', '+00:00'))
        ended_at = datetime.fromisoformat(request.ended_at.replace('Z', '+00:00'))
        
        game = game_history_service.create_game_history(
            room_id=request.room_id,
            player1_id=player1.id,
            player2_id=player2.id,
            player1_score=request.player1_score,
            player2_score=request.player2_score,
            player1_words=request.player1_words,
            player2_words=request.player2_words,
            winner_id=winner_id,
            duration=request.duration,
            letter_pool=request.letter_pool,
            started_at=started_at,
            ended_at=ended_at
        )
        
        player1_won = winner_id == player1.id if winner_id else False
        player1_tied = winner_id is None
        stats_service.update_stats_after_game(
            user_id=player1.id,
            score=request.player1_score,
            words=request.player1_words,
            won=player1_won,
            tied=player1_tied,
            game_duration=request.duration
        )
        
        player2_won = winner_id == player2.id if winner_id else False
        player2_tied = winner_id is None
        stats_service.update_stats_after_game(
            user_id=player2.id,
            score=request.player2_score,
            words=request.player2_words,
            won=player2_won,
            tied=player2_tied,
            game_duration=request.duration
        )
        
        return SaveGameResponse(
            success=True,
            message="Game saved successfully",
            game_id=game.id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving game: {e}")
        raise HTTPException(status_code=500, detail=str(e))
