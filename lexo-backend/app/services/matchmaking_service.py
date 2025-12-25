from typing import List, Dict, Optional
from datetime import datetime
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
        self.connected_players: Dict[str, Player] = {}
        self.notification_sockets: Dict[str, any] = {}
        self.friend_invites: Dict[str, Dict] = {}
        self.invites_by_user: Dict[str, str] = {}
    
    def add_to_queue(self, player: Player) -> int:
        self.waiting_queue = [p for p in self.waiting_queue if p.id != player.id]
        self.waiting_queue.append(player)
        logger.info(f"Player {player.username} ({player.id}) joined queue")
        return len(self.waiting_queue)
    
    def remove_from_queue(self, player: Player):
        if player in self.waiting_queue:
            self.waiting_queue.remove(player)
            logger.info(f"Removed {player.username} from queue")

    def remove_from_queue_by_id(self, player_id: str):
        self.waiting_queue = [p for p in self.waiting_queue if p.id != player_id]
    
    def try_match_players(self) -> Optional[GameRoom]:
        if len(self.waiting_queue) < 2:
            return None

        player1 = self.waiting_queue.pop(0)
        player2 = None
        for i, candidate in enumerate(self.waiting_queue):
            if candidate.id != player1.id:
                player2 = candidate
                del self.waiting_queue[i]
                break

        if not player2:
            self.waiting_queue.insert(0, player1)
            return None
        
        room_id = str(uuid.uuid4())
        room = self.game_service.create_game_room(room_id, player1, player2)
        
        self.active_rooms[room_id] = room
        self.player_rooms[player1.id] = room_id
        self.player_rooms[player2.id] = room_id
        
        logger.info(f"Matched {player1.username} vs {player2.username} in room {room_id}")
        return room

    def create_room_with_players(self, player1: Player, player2: Player) -> GameRoom:
        room_id = str(uuid.uuid4())
        room = self.game_service.create_game_room(room_id, player1, player2)

        self.active_rooms[room_id] = room
        self.player_rooms[player1.id] = room_id
        self.player_rooms[player2.id] = room_id
        logger.info(f"Created friend match {player1.username} vs {player2.username} in room {room_id}")
        return room
    
    def get_room_by_player(self, player_id: str) -> Optional[GameRoom]:
        room_id = self.player_rooms.get(player_id)
        if room_id:
            return self.active_rooms.get(room_id)
        return None

    def register_player(self, player: Player) -> None:
        self.connected_players[player.id] = player

    def unregister_player(self, player_id: str) -> None:
        if player_id in self.connected_players:
            del self.connected_players[player_id]

    def register_notification(self, user_id: str, websocket) -> None:
        self.notification_sockets[user_id] = websocket

    def unregister_notification(self, user_id: str) -> None:
        if user_id in self.notification_sockets:
            del self.notification_sockets[user_id]

    def get_notification(self, user_id: str):
        return self.notification_sockets.get(user_id)

    def get_connected_player(self, player_id: str) -> Optional[Player]:
        return self.connected_players.get(player_id)

    def is_player_busy(self, player_id: str) -> bool:
        return player_id in self.player_rooms

    def store_invite(
        self,
        invite_id: str,
        inviter_id: str,
        target_id: str,
        inviter_name: str,
        target_name: str,
        inviter_in_queue: bool,
        target_in_queue: bool,
    ) -> None:
        self.friend_invites[invite_id] = {
            "invite_id": invite_id,
            "inviter_id": inviter_id,
            "target_id": target_id,
            "inviter_name": inviter_name,
            "target_name": target_name,
            "inviter_in_queue": inviter_in_queue,
            "target_in_queue": target_in_queue,
            "status": "pending",
            "joiners": set(),
            "created_at": datetime.utcnow(),
        }
        self.invites_by_user[inviter_id] = invite_id
        self.invites_by_user[target_id] = invite_id

    def pop_invite(self, invite_id: str) -> Optional[Dict]:
        invite = self.friend_invites.pop(invite_id, None)
        if invite:
            self.invites_by_user.pop(invite["inviter_id"], None)
            self.invites_by_user.pop(invite["target_id"], None)
        return invite

    def get_invite_for_user(self, user_id: str) -> Optional[str]:
        return self.invites_by_user.get(user_id)

    def is_in_queue(self, player_id: str) -> bool:
        return any(player.id == player_id for player in self.waiting_queue)

    def cancel_invite_by_inviter(self, inviter_id: str) -> Optional[Dict]:
        invite_id = self.invites_by_user.get(inviter_id)
        if not invite_id:
            return None
        invite = self.friend_invites.get(invite_id)
        if not invite or invite.get("inviter_id") != inviter_id:
            return None
        return self.pop_invite(invite_id)

    def create_invite(self, inviter_id: str, inviter_name: str, target_id: str, target_name: str) -> Dict:
        if inviter_id in self.invites_by_user or target_id in self.invites_by_user:
            raise ValueError("Invite already exists")
        invite_id = str(uuid.uuid4())
        inviter_in_queue = self.is_in_queue(inviter_id)
        target_in_queue = self.is_in_queue(target_id)
        self.store_invite(
            invite_id,
            inviter_id,
            target_id,
            inviter_name,
            target_name,
            inviter_in_queue,
            target_in_queue,
        )
        return self.friend_invites[invite_id]

    def get_active_invite_for_user(self, user_id: str) -> Optional[Dict]:
        invite_id = self.invites_by_user.get(user_id)
        if not invite_id:
            return None
        invite = self.friend_invites.get(invite_id)
        if not invite or invite.get("status") != "pending":
            return None
        if invite.get("target_id") != user_id:
            return None
        return invite

    def set_invite_status(self, invite_id: str, status: str) -> Optional[Dict]:
        invite = self.friend_invites.get(invite_id)
        if not invite:
            return None
        invite["status"] = status
        if status in ("declined", "cancelled"):
            self.pop_invite(invite_id)
        return invite

    def mark_invite_join(self, invite_id: str, player: Player) -> Optional[GameRoom]:
        invite = self.friend_invites.get(invite_id)
        if not invite:
            return None
        if invite.get("status") != "accepted":
            return None
        invite["joiners"].add(player.id)
        if invite["inviter_id"] in invite["joiners"] and invite["target_id"] in invite["joiners"]:
            room = self.create_room_with_players(
                self.connected_players[invite["inviter_id"]],
                self.connected_players[invite["target_id"]],
            )
            self.pop_invite(invite_id)
            return room
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
