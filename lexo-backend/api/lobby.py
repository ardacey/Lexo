from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from game.manager import manager

router = APIRouter()

class CreateRoomRequest(BaseModel):
    name: str

@router.get("/rooms")
async def get_rooms():
    active_rooms = manager.get_active_rooms()
    return active_rooms

@router.post("/rooms")
async def create_room(request: CreateRoomRequest):
    if not request.name.strip():
        raise HTTPException(status_code=400, detail="Room name cannot be empty")
    
    room = manager.create_room(request.name)
    return {"id": room.id, "name": room.name}