import uuid
import time
from typing import Dict, List, Tuple, cast
from fastapi import WebSocket
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from .models_db import RoomDB, PlayerDB, RoomStatus
from .logic import calculate_score, has_letters_in_pool, generate_letter_pool
from .word_list import is_word_valid
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, ws: WebSocket, room_id: str, player_id: str):
        await ws.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][player_id] = ws

    def disconnect(self, room_id: str, player_id: str):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            del self.active_connections[room_id][player_id]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
    
    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            for ws in self.active_connections[room_id].values():
                await ws.send_json(message)

connection_manager = ConnectionManager()
class RoomService:
    def __init__(self, db: Session):
        self.db = db

    def get_room(self, room_id: str) -> RoomDB | None:
        return self.db.query(RoomDB).filter(RoomDB.id == room_id).first()

    def get_active_rooms(self) -> List[RoomDB]:
        subquery = (
            select(PlayerDB.room_id, func.count(PlayerDB.id).label("player_count"))
            .group_by(PlayerDB.room_id)
            .subquery()
        )

        return (
            self.db.query(RoomDB)
            .outerjoin(subquery, RoomDB.id == subquery.c.room_id)
            .filter(RoomDB.status == RoomStatus.WAITING)
            .filter(func.coalesce(subquery.c.player_count, 0) < 2)
            .all()
        )

    def create_room(self, name: str, username: str) -> Tuple[RoomDB, PlayerDB]:
        room_id = str(uuid.uuid4())
        player_id = str(uuid.uuid4())
        
        new_room = RoomDB(
            id=room_id, name=name, status=RoomStatus.WAITING,
            letter_pool=generate_letter_pool(22), used_words=[]
        )
        new_player = PlayerDB(
            id=player_id, username=username, room_id=room_id, words=[]
        )
        self.db.add(new_room)
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(new_room)
        self.db.refresh(new_player)
        return new_room, new_player

    def join_room(self, room_id: str, username: str) -> Tuple[RoomDB, PlayerDB]:
        room = self.get_room(room_id)
        if not room: raise ValueError("Room not found")
        if len(room.players) >= 2: raise ValueError("Room is full")

        player_id = str(uuid.uuid4())
        new_player = PlayerDB(id=player_id, username=username, room_id=room_id, words=[])
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(room)
        return room, new_player

    def start_game_for_room(self, room: RoomDB):
        setattr(room, 'started', True)
        setattr(room, 'status', RoomStatus.IN_PROGRESS)
        setattr(room, 'time_left', 30)
        setattr(room, 'used_words', [])
        
        for player in room.players:
            setattr(player, 'score', 0)
            setattr(player, 'words', [])

        self.db.commit()
        self.db.refresh(room)

    def process_word(self, room_id: str, player_id: str, word: str) -> Tuple[bool, dict]:
        room = self.get_room(room_id)
        player = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()

        if not player or not room:
            return False, {"type": "error", "message": "Player or Room not found."}
        
        if not room.started or room.status != RoomStatus.IN_PROGRESS: # type: ignore
            return False, {"type": "error", "message": "Game is not currently in progress."}

        lower_word = word.lower()

        room_used_words = cast(List[str], room.used_words)
        room_letter_pool = cast(List[str], room.letter_pool)
        player_words = cast(List[str], player.words)
        
        if lower_word in room_used_words:
            return False, {"type": "error", "message": f'"{lower_word}" has already been played.'}
        
        if not has_letters_in_pool(lower_word, room_letter_pool):
            return False, {"type": "error", "message": f'Not enough letters for "{lower_word}".'}
        
        if not is_word_valid(lower_word):
            return False, {"type": "word_result", "word": lower_word, "valid": False, "message": f'"{lower_word}" is not a valid word.'}

        score = calculate_score(lower_word)

        new_letter_pool = list(room_letter_pool)
        for letter in lower_word:
            new_letter_pool.remove(letter)
        new_letter_pool.extend(generate_letter_pool(len(lower_word)))
        
        setattr(player, 'score', player.score + score)
        setattr(player, 'words', player_words + [lower_word])
        setattr(room, 'used_words', room_used_words + [lower_word])
        setattr(room, 'letter_pool', new_letter_pool)
        
        self.db.commit()
        self.db.refresh(room)
        self.db.refresh(player)
        
        success_data = {
            "word": lower_word,
            "score": score,
            "player_total_score": player.score,
            "new_letter_pool": room.letter_pool,
            "current_scores": [{"username": p.username, "score": p.score} for p in room.players]
        }
        
        return True, success_data

    def end_game(self, room_id: str) -> Tuple[RoomDB, dict]:
        room = self.get_room(room_id)
        if not room: raise ValueError("Cannot end a non-existent room.")
            
        setattr(room, 'started', False)
        setattr(room, 'status', RoomStatus.FINISHED)
        
        scores = sorted([{"username": p.username, "score": p.score} for p in room.players], key=lambda x: x["score"], reverse=True)
        winner_data, is_tie = None, False
        
        if scores:
            highest_score = scores[0]["score"]
            winners = [p for p in scores if p["score"] == highest_score]
            if len(winners) > 1: is_tie = True
            winner_data = {"usernames": [w["username"] for w in winners], "score": highest_score}

        self.db.commit()
        self.db.refresh(room)
        
        return room, {"scores": scores, "winner_data": winner_data, "is_tie": is_tie}

    def handle_disconnect(self, room_id: str, player_id: str) -> Tuple[RoomDB | None, PlayerDB | None, bool]:
        room = self.get_room(room_id)
        if not room:
            return None, None, False
            
        player_leaving = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()
        if not player_leaving:
            return room, None, False

        if room.status == RoomStatus.IN_PROGRESS and len(room.players) == 2: # type: ignore
            
            self.db.delete(player_leaving)
            self.db.commit()
            
            updated_room = self.get_room(room_id)
            if updated_room and len(updated_room.players) == 1:
                setattr(updated_room, 'started', False)
                setattr(updated_room, 'status', RoomStatus.FINISHED)
                self.db.commit()
                return updated_room, player_leaving, True
            
        self.db.delete(player_leaving)
        self.db.commit()
        
        final_room_state = self.get_room(room_id)
        if not final_room_state:
            return None, player_leaving, False
            
        return final_room_state, player_leaving, False