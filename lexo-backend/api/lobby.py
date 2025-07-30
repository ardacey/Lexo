from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from game.manager import RoomService
class CreateRoomRequest(BaseModel):
    name: str
    username: str
class JoinRoomRequest(BaseModel):
    username: str

router = APIRouter()

@router.get("/rooms", tags=["Lobby"])
def get_rooms_list(db: Session = Depends(get_db)):
    service = RoomService(db)
    active_rooms = service.get_active_rooms()
    return [
        {
            "id": room.id, "name": room.name,
            "player_count": len(room.players), "max_players": 2,
            "status": room.status.value
        } for room in active_rooms
    ]

@router.post("/rooms", tags=["Lobby"])
def create_room(request: CreateRoomRequest, db: Session = Depends(get_db)):
    service = RoomService(db)
    try:
        room, player = service.create_room(name=request.name, username=request.username)
        return {"room_id": room.id, "player_id": player.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rooms/{room_id}/join", tags=["Lobby"])
def join_room(room_id: str, request: JoinRoomRequest, db: Session = Depends(get_db)):
    service = RoomService(db)
    try:
        room, player = service.join_room(room_id=room_id, username=request.username)
        return {"room_id": room.id, "player_id": player.id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))