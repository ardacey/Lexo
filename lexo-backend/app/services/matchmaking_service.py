from typing import List, Dict, Optional
import uuid

from app.models.domain import Player, GameRoom
from app.services.game_service import GameService
from app.core.logging import get_logger

logger = get_logger(__name__)


class MatchmakingService:
    
    def __init__(self, game_service: GameService):
        self.game_service = game_service
        self.waiting_queue: List[Player] = []
        self.active_rooms: Dict[str, GameRoom] = {}
        self.player_rooms: Dict[str, str] = {}
    
    def add_to_queue(self, player: Player) -> int:
        self.waiting_queue.append(player)
        logger.info(f"Player {player.username} ({player.id}) joined queue")
        return len(self.waiting_queue)
    
    def remove_from_queue(self, player: Player):
        if player in self.waiting_queue:
            self.waiting_queue.remove(player)
            logger.info(f"Removed {player.username} from queue")
    
    def try_match_players(self) -> Optional[GameRoom]:
        if len(self.waiting_queue) < 2:
            return None
        
        player1 = self.waiting_queue.pop(0)
        player2 = self.waiting_queue.pop(0)
        
        room_id = str(uuid.uuid4())
        room = self.game_service.create_game_room(room_id, player1, player2)
        
        self.active_rooms[room_id] = room
        self.player_rooms[player1.id] = room_id
        self.player_rooms[player2.id] = room_id
        
        logger.info(f"Matched {player1.username} vs {player2.username} in room {room_id}")
        return room
    
    def get_room_by_player(self, player_id: str) -> Optional[GameRoom]:
        room_id = self.player_rooms.get(player_id)
        if room_id:
            return self.active_rooms.get(room_id)
        return None
    
    def cleanup_room(self, room_id: str):
        if room_id in self.active_rooms:
            room = self.active_rooms[room_id]
            
            if room.player1.id in self.player_rooms:
                del self.player_rooms[room.player1.id]
            if room.player2.id in self.player_rooms:
                del self.player_rooms[room.player2.id]
            
            del self.active_rooms[room_id]
            logger.info(f"Cleaned up room {room_id}")
    
    def get_stats(self) -> Dict:
        return {
            'active_rooms': len(self.active_rooms),
            'waiting_players': len(self.waiting_queue)
        }
