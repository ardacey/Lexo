from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from core.database import get_db
from auth.dependencies import get_current_user
from auth.models import UserDB
from auth.utils import verify_token
from auth.services import UserService
from game.stats_models import UserStats, GameHistory, WordHistory
from game.stats_schemas import (
    UserStatsResponse, 
    LeaderboardResponse, 
    GameHistoryResponse,
    WordHistoryResponse
)
import uuid

router = APIRouter(prefix="/stats", tags=["statistics"])

async def get_current_user_manual(request: Request, db: Session = Depends(get_db)) -> UserDB:
    print("DEBUG: Manual auth - checking authorization header")
    
    authorization = request.headers.get("Authorization")
    if not authorization:
        print("DEBUG: No authorization header")
        raise HTTPException(status_code=401, detail="No authorization header")
    
    if not authorization.startswith("Bearer "):
        print("DEBUG: Invalid authorization format")
        raise HTTPException(status_code=401, detail="Invalid authorization format")
    
    token = authorization[7:]
    print(f"DEBUG: Extracted token: {token[:10]}...")
    
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        print(f"DEBUG: Token verified, user_id: {user_id}")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user_service = UserService(db)
        user = user_service.get_user_by_id(user_id)
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        print(f"DEBUG: User found: {user.username}")
        return user
        
    except Exception as e:
        print(f"DEBUG: Authentication failed: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

@router.get("/user/{user_id}", response_model=UserStatsResponse)
async def get_user_stats(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    user_stats = db.query(UserStats).filter(UserStats.user_id == user_id).first()
    
    if not user_stats:
        user_stats = UserStats(
            id=str(uuid.uuid4()),
            user_id=user_id
        )
        db.add(user_stats)
        db.commit()
        db.refresh(user_stats)
    
    return user_stats

@router.get("/my-stats", response_model=UserStatsResponse)
async def get_my_stats(
    request: Request,
    db: Session = Depends(get_db)
):
    current_user = await get_current_user_manual(request, db)
    print(f"DEBUG: Getting stats for user {current_user.id}")
    
    user_stats = db.query(UserStats).filter(UserStats.user_id == str(current_user.id)).first()
    
    if not user_stats:
        user_stats = UserStats(
            id=str(uuid.uuid4()),
            user_id=str(current_user.id)
        )
        db.add(user_stats)
        db.commit()
        db.refresh(user_stats)
    
    print(f"DEBUG: User stats result: total_games={user_stats.total_games}, wins={user_stats.wins}, total_score={user_stats.total_score}")
    return user_stats

@router.get("/leaderboard", response_model=List[LeaderboardResponse])
async def get_leaderboard(
    limit: int = 10,
    sort_by: str = "total_score",
    db: Session = Depends(get_db)
):
    valid_sort_fields = [
        "total_score", "wins", "total_games", "average_score", 
        "longest_word_length", "total_words"
    ]
    
    if sort_by not in valid_sort_fields:
        sort_by = "total_score"
    
    query = db.query(UserStats, UserDB.username).join(
        UserDB, UserStats.user_id == UserDB.id
    ).filter(UserStats.total_games > 0)
    
    sort_field = getattr(UserStats, sort_by)
    query = query.order_by(desc(sort_field))
    
    results = query.limit(limit).all()
    
    leaderboard = []
    for rank, (stats, username) in enumerate(results, 1):
        win_rate = (stats.wins / stats.total_games * 100) if stats.total_games > 0 else 0
        
        leaderboard.append(LeaderboardResponse(
            rank=rank,
            username=username,
            total_score=stats.total_score,
            wins=stats.wins,
            total_games=stats.total_games,
            win_rate=round(win_rate, 1),
            average_score=stats.average_score,
            longest_word=stats.longest_word,
            longest_word_length=stats.longest_word_length
        ))
    
    return leaderboard

@router.get("/game-history", response_model=List[GameHistoryResponse])
async def get_game_history(
    limit: int = 20,
    game_mode: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    query = db.query(GameHistory).filter(GameHistory.user_id == current_user.id)
    
    if game_mode:
        query = query.filter(GameHistory.game_mode == game_mode)
    
    games = query.order_by(desc(GameHistory.created_at)).limit(limit).all()
    
    return games

@router.get("/word-history", response_model=List[WordHistoryResponse])
async def get_word_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    words = db.query(WordHistory).filter(
        WordHistory.user_id == current_user.id
    ).order_by(desc(WordHistory.played_at)).limit(limit).all()
    
    return words

@router.get("/quick-stats")
async def get_quick_stats(
    db: Session = Depends(get_db)
):
    total_users = db.query(UserDB).count()
    total_games = db.query(func.sum(UserStats.total_games)).scalar() or 0
    total_words = db.query(func.sum(UserStats.total_words)).scalar() or 0
    
    top_player = db.query(UserStats, UserDB.username).join(
        UserDB, UserStats.user_id == UserDB.id
    ).filter(UserStats.total_games > 0).order_by(
        desc(UserStats.total_score)
    ).first()
    
    top_player_info = None
    if top_player:
        stats, username = top_player
        top_player_info = {
            "username": username,
            "total_score": stats.total_score
        }
    
    return {
        "total_users": total_users,
        "total_games": total_games,
        "total_words": total_words,
        "top_player": top_player_info
    }
