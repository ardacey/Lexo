from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from game.manager import RoomService
from game.models_db import RoomStatus, GameMode
from auth.dependencies import get_current_user
from auth.models import UserDB

class CreateRoomRequest(BaseModel):
    name: str
    game_mode: Optional[str] = "classic"

class JoinRoomRequest(BaseModel):
    as_viewer: Optional[bool] = False

router = APIRouter()

@router.get("/rooms", tags=["Lobby"])
def get_rooms_list(db: Session = Depends(get_db)):
    service = RoomService(db)
    try:
        service.cleanup_finished_rooms()
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error during room cleanup: {e}")
    
    all_rooms = service.get_all_rooms()
    
    room_list = []
    for room in all_rooms:
        active_players = [p for p in room.players if not p.is_viewer]
        total_players = len(room.players)
        
        room_data = {
            "id": room.id,
            "name": room.name,
            "game_mode": room.game_mode.value,
            "player_count": len(active_players),
            "total_count": total_players,
            "max_players": room.max_players,
            "min_players": room.min_players,
            "status": room.status.value,
            "is_joinable": room.is_joinable,
            "is_viewable": room.is_viewable
        }
        
        if len(active_players) > 0 or room.status != RoomStatus.WAITING: # type: ignore
            room_list.append(room_data)
    
    return room_list

@router.post("/rooms", tags=["Lobby"])
def create_room(
    request: CreateRoomRequest, 
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    service = RoomService(db)
    try:
        game_mode = GameMode.CLASSIC
        if request.game_mode == "battle_royale":
            game_mode = GameMode.BATTLE_ROYALE
        elif request.game_mode != "classic":
            raise HTTPException(status_code=400, detail="Invalid game mode. Use 'classic' or 'battle_royale'")
            
        room, player = service.create_room(
            name=request.name, 
            username=str(current_user.username), 
            user_id=str(current_user.id),
            game_mode=game_mode
        )
        return {"room_id": room.id, "player_id": player.id, "game_mode": room.game_mode.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rooms/{room_id}/join", tags=["Lobby"])
def join_room(
    room_id: str, 
    request: JoinRoomRequest, 
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    service = RoomService(db)
    try:
        room, player = service.join_room(
            room_id=room_id, 
            username=str(current_user.username),
            user_id=str(current_user.id),
            as_viewer=request.as_viewer or False
        )
        return {"room_id": room.id, "player_id": player.id, "is_viewer": player.is_viewer}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))