import uuid
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Tuple, cast, Optional
from fastapi import WebSocket
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, select
from .models_db import RoomDB, PlayerDB, RoomStatus
from .logic import calculate_score, has_letters_in_pool, generate_letter_pool
from .word_list import is_word_valid
class ConnectionManager:
    def __init__(self, max_connections_per_room: int = 50):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}
        self.max_connections_per_room = max_connections_per_room

    async def connect(self, ws: WebSocket, room_id: str, player_id: str):
        current_connections = len(self.active_connections.get(room_id, {}))
        if current_connections >= self.max_connections_per_room:
            await ws.accept()
            await ws.close(code=4008, reason="Room connection limit reached")
            return False
            
        await ws.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][player_id] = ws
        return True

    def disconnect(self, room_id: str, player_id: str):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            del self.active_connections[room_id][player_id]
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                if room_id in self.cleanup_tasks:
                    self.cleanup_tasks[room_id].cancel()
                self.cleanup_tasks[room_id] = asyncio.create_task(
                    self._cleanup_empty_room(room_id)
                )
    
    async def _cleanup_empty_room(self, room_id: str):
        try:
            await asyncio.sleep(30)
            from core.database import SessionLocal
            db = SessionLocal()
            try:
                service = RoomService(db)
                service.cleanup_empty_room(room_id)
            finally:
                db.close()
                if room_id in self.cleanup_tasks:
                    del self.cleanup_tasks[room_id]
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"Error during room cleanup {room_id}: {e}")
    
    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            disconnected = []
            for player_id, ws in self.active_connections[room_id].items():
                try:
                    await ws.send_json(message)
                except Exception:
                    disconnected.append(player_id)
            
            for player_id in disconnected:
                self.disconnect(room_id, player_id)

    def get_room_connections(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, {}))

connection_manager = ConnectionManager()
class RoomService:
    def __init__(self, db: Session):
        self.db = db

    def get_room(self, room_id: str) -> Optional[RoomDB]:
        return self.db.query(RoomDB).options(joinedload(RoomDB.players)).filter(RoomDB.id == room_id).first()

    def get_player(self, player_id: str) -> Optional[PlayerDB]:
        return self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()

    def get_all_rooms(self) -> List[RoomDB]:
        return self.db.query(RoomDB).options(joinedload(RoomDB.players)).all()

    def get_joinable_rooms(self) -> List[RoomDB]:
        return (
            self.db.query(RoomDB)
            .filter(RoomDB.status == RoomStatus.WAITING)
            .filter(func.coalesce(func.count(PlayerDB.id), 0) < RoomDB.max_players)
            .outerjoin(PlayerDB)
            .group_by(RoomDB.id)
            .having(func.count(PlayerDB.id) > 0)
            .all()
        )

    def get_viewable_rooms(self) -> List[RoomDB]:
        return (
            self.db.query(RoomDB)
            .filter(RoomDB.status.in_([RoomStatus.IN_PROGRESS, RoomStatus.COUNTDOWN]))
            .filter(func.count(PlayerDB.id) > 0)
            .join(PlayerDB)
            .group_by(RoomDB.id)
            .all()
        )

    def cleanup_empty_room(self, room_id: str):
        room = self.get_room(room_id)
        if room and room.should_be_deleted: # type: ignore
            self.db.delete(room)
            self.db.commit()
            print(f"Cleaned up empty room: {room_id}")

    def cleanup_finished_rooms(self):
        finished_room_ids = (
            self.db.query(RoomDB.id)
            .filter(
                (RoomDB.status == RoomStatus.FINISHED) |
                (~RoomDB.players.any())
            )
            .all()
        )
        
        if finished_room_ids:
            room_ids_to_delete = [r.id for r in finished_room_ids]
            self.db.query(RoomDB).filter(
                RoomDB.id.in_(room_ids_to_delete)
            ).delete(synchronize_session=False)
            self.db.commit()
            print(f"Cleaned up {len(finished_room_ids)} finished/empty rooms")

    def create_room(self, name: str, username: str) -> Tuple[RoomDB, PlayerDB]:
        room_id = str(uuid.uuid4())
        player_id = str(uuid.uuid4())
        
        new_room = RoomDB(
            id=room_id, 
            name=name, 
            status=RoomStatus.WAITING,
            letter_pool=generate_letter_pool(22), 
            used_words=[]
        )
        new_player = PlayerDB(
            id=player_id, 
            username=username, 
            room_id=room_id, 
            words=[],
            is_viewer=False
        )
        self.db.add(new_room)
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(new_room)
        self.db.refresh(new_player)
        return new_room, new_player

    def join_room(self, room_id: str, username: str, as_viewer: bool = False) -> Tuple[RoomDB, PlayerDB]:
        room = self.get_room(room_id)
        if not room: 
            raise ValueError("Room not found")
        
        if not as_viewer:
            if not room.is_joinable: # type: ignore
                if room.status != RoomStatus.WAITING: # type: ignore
                    as_viewer = True
                else:
                    raise ValueError("Room is full")
        
        player_id = str(uuid.uuid4())
        new_player = PlayerDB(
            id=player_id, 
            username=username, 
            room_id=room_id, 
            words=[],
            is_viewer=as_viewer
        )
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(room)
        return room, new_player

    def start_game_for_room(self, room: RoomDB):
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        if len(active_players) != 2:
            return False
            
        setattr(room, 'started', True)
        setattr(room, 'status', RoomStatus.IN_PROGRESS)
        setattr(room, 'time_left', 120)
        setattr(room, 'game_start_time', datetime.now())
        setattr(room, 'used_words', [])
        
        for player in active_players:
            setattr(player, 'score', 0)
            setattr(player, 'words', [])

        self.db.commit()
        self.db.refresh(room)
        return True

    def process_word(self, room_id: str, player_id: str, word: str) -> Tuple[bool, dict]:
        room = self.get_room(room_id)
        player = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()

        if not player or not room:
            return False, {"type": "error", "message": "Player or Room not found."}
        
        if getattr(player, 'is_viewer', False):
            return False, {"type": "error", "message": "Viewers cannot submit words."}
        
        if not getattr(room, 'started', False) or getattr(room, 'status', None) != RoomStatus.IN_PROGRESS:
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
        
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        success_data = {
            "word": lower_word,
            "score": score,
            "player_total_score": player.score,
            "new_letter_pool": room.letter_pool,
            "current_scores": [{"username": p.username, "score": p.score} for p in active_players]
        }
        
        return True, success_data

    def end_game(self, room_id: str) -> Tuple[RoomDB, dict]:
        room = self.get_room(room_id)
        if not room: 
            raise ValueError("Cannot end a non-existent room.")
            
        setattr(room, 'started', False)
        setattr(room, 'status', RoomStatus.FINISHED)
        
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        scores = sorted([{"username": p.username, "score": p.score} for p in active_players], key=lambda x: x["score"], reverse=True)
        winner_data, is_tie = None, False
        
        if scores:
            highest_score = scores[0]["score"]
            winners = [p for p in scores if p["score"] == highest_score]
            if len(winners) > 1: is_tie = True
            winner_data = {"usernames": [w["username"] for w in winners], "score": highest_score}

        self.db.commit()
        self.db.refresh(room)
        
        asyncio.create_task(self._schedule_room_cleanup(room_id))
        
        return room, {"scores": scores, "winner_data": winner_data, "is_tie": is_tie}

    async def _schedule_room_cleanup(self, room_id: str):
        await asyncio.sleep(60)
        self.cleanup_empty_room(room_id)

    def handle_disconnect(self, room_id: str, player_id: str) -> Tuple[Optional[RoomDB], Optional[PlayerDB], bool]:
        room = self.get_room(room_id)
        if not room:
            return None, None, False
            
        player_leaving = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()
        if not player_leaving:
            return room, None, False

        if getattr(player_leaving, 'is_viewer', False):
            self.db.delete(player_leaving)
            self.db.commit()
            return self.get_room(room_id), player_leaving, False

        if room.status in [RoomStatus.IN_PROGRESS, RoomStatus.COUNTDOWN]:
            active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
            
            if len(active_players) == 2:
                self.db.delete(player_leaving)
                self.db.commit()
                
                updated_room = self.get_room(room_id)
                if updated_room:
                    remaining_active = [p for p in updated_room.players if not p.is_viewer]
                    if len(remaining_active) == 1:
                        setattr(updated_room, 'started', False)
                        setattr(updated_room, 'status', RoomStatus.FINISHED)
                        self.db.commit()
                        return updated_room, player_leaving, True
        
        self.db.delete(player_leaving)
        self.db.commit()
        
        final_room_state = self.get_room(room_id)
        
        if final_room_state and (len(final_room_state.players) == 0 or getattr(final_room_state, 'status', None) == RoomStatus.FINISHED):
            self.cleanup_empty_room(room_id)
            return None, player_leaving, False
            
        return final_room_state, player_leaving, False