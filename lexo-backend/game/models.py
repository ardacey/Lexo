import uuid
from typing import List, Dict, Set, Optional
from enum import Enum
from fastapi import WebSocket
from starlette.websockets import WebSocketState
from .constants import INITIAL_LETTER_POOL_SIZE, MAX_PLAYERS_PER_ROOM, GAME_DURATION_SECONDS
from .logic import generate_letter_pool

class RoomStatus(str, Enum):
    WAITING = "waiting"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

class Player:
    def __init__(self, ws: WebSocket, username: str):
        self.ws = ws
        self.id = str(uuid.uuid4())
        self.username = username
        self.score = 0
        self.words: List[str] = []

class Room:
    def __init__(self, room_id: str, name: str):
        self.id = room_id
        self.name = name
        self.status = RoomStatus.WAITING
        self.players: Dict[str, Player] = {}
        self.letter_pool: List[str] = generate_letter_pool(INITIAL_LETTER_POOL_SIZE)
        self.started = False
        self.time_left = 0
        self.used_words: Set[str] = set()

    def add_player(self, player: Player):
        if self.is_full():
            raise Exception("Room is full")
        self.players[player.id] = player

    def remove_player(self, player_id: str):
        if player_id in self.players:
            del self.players[player_id]

    def is_full(self) -> bool:
        return len(self.players) >= MAX_PLAYERS_PER_ROOM

    def is_empty(self) -> bool:
        return not self.players
    
    def get_max_players(self) -> int:
        return MAX_PLAYERS_PER_ROOM

    def get_player(self, player_id: str) -> Optional[Player]:
        return self.players.get(player_id)
    
    def get_opponents(self, player: Player) -> List[Player]:
        return [p for p in self.players.values() if p.id != player.id]

    def start_game(self):
        self.started = True
        self.status = RoomStatus.IN_PROGRESS
        self.time_left = GAME_DURATION_SECONDS
        self.used_words.clear()

    def add_used_word(self, word: str):
        self.used_words.add(word.lower())

    def is_word_used_in_room(self, word: str) -> bool:
        return word.lower() in self.used_words
        
    async def broadcast(self, message: dict):
        for player in self.players.values():
            if player.ws.client_state == WebSocketState.CONNECTED:
                try:
                    await player.ws.send_json(message)
                except Exception as e:
                    print(f"Could not send message to {player.username}: {e}")
            else:
                print(f"Skipping sending message to {player.username} as they are disconnected.")
            
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "player_count": len(self.players),
            "max_players": MAX_PLAYERS_PER_ROOM,
            "status": self.status.value
        }
    
    def get_scores(self) -> list[dict]:
        return sorted(
            [{"username": p.username, "score": p.score} for p in self.players.values()],
            key=lambda x: x["score"],
            reverse=True
        )