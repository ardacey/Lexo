import uuid
import threading
from typing import Dict, Tuple, List, Set
from fastapi import WebSocket
from .models import Room, Player, RoomStatus
import asyncio
import time

class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        self.countdown_rooms: Set[str] = set()
        self._lock = threading.Lock()

    def create_room(self, name: str) -> Room:
        with self._lock:
            room_id = str(uuid.uuid4())
            room = Room(room_id=room_id, name=name)
            self.rooms[room_id] = room
            print(f"Room '{name}' ({room_id}) created.")
            return room
    
    def get_active_rooms(self) -> List[dict]:
        with self._lock:
            active_rooms = [
                room.to_dict() for room in self.rooms.values() 
                if not room.is_full() and room.status != RoomStatus.FINISHED
            ]
        return active_rooms

    async def connect(self, websocket: WebSocket, room_id: str, username: str) -> Tuple[Room, Player]:
        with self._lock:
            if room_id not in self.rooms:
                raise ValueError("Room not found.")
            room = self.rooms[room_id]
            if room.is_full():
                raise ValueError("This room is full.")

        await websocket.accept()
        
        player = Player(websocket, username)
        with self._lock:
            if len(room.players) >= room.get_max_players():
                await websocket.close(code=4010, reason="Room became full just before you joined.")
                raise ValueError("Room became full just before joining.")
            
            room.add_player(player)

        print(f"Player '{username}' ({player.id}) connected to room '{room.name}'. Total players: {len(room.players)}")
        return room, player

    async def disconnect(self, room: Room, player: Player):
        leaver_username = player.username
        room_id = room.id
        room_name = room.name

        print(f"[DISCONNECT_START] Player: {leaver_username}, Room: {room_name} ({room_id}), Status: {room.status.value}")
        
        was_in_progress = room.status == RoomStatus.IN_PROGRESS
        was_in_countdown = room_id in self.countdown_rooms

        room.remove_player(player.id)

        if room.is_empty():
            with self._lock:
                print(f"[DISCONNECT_CLEANUP] Room '{room.name}' is empty. Deleting.")
                if room.id in self.rooms:
                    del self.rooms[room.id]
            return

        print(f"[DISCONNECT_CONTINUE] Room '{room_name}' not empty. Players left: {len(room.players)}. Was in progress: {was_in_progress}")

        if (was_in_progress or was_in_countdown) and len(room.players) == 1:
            winner = list(room.players.values())[0]
            print(f"[DISCONNECT_WALKOVER] Player left during game/countdown. {winner.username} wins.")
            
            if was_in_countdown and room_id in self.countdown_rooms:
                self.countdown_rooms.remove(room_id)
            
            await self.end_game_by_walkover(room, winner)
            
            await winner.ws.send_json({
                "type": "player_left",
                "message": f"Player '{leaver_username}' left the game.",
                "players": [p.username for p in room.players.values()]
            })
            return

        else:
            print(f"[DISCONNECT_INFO] Game was not in progress/countdown. Broadcasting player_left.")
            await self.broadcast_to_room(room, {
                "type": "player_left",
                "message": f"Player '{leaver_username}' has left.",
                "players": [p.username for p in room.players.values()]
            })
            
        print(f"[DISCONNECT_END] Finished handling disconnection for {leaver_username} in '{room_name}'.")

    async def end_game_by_walkover(self, room: Room, winner: Player):
        room.status = RoomStatus.FINISHED
        room.started = False
        
        scores = room.get_scores()
        
        message = {
            "type": "game_over",
            "scores": scores,
            "winner_data": {"usernames": [winner.username], "score": winner.score},
            "is_tie": False,
            "reason": f"You won! Your opponent left the game."
        }
        
        await winner.ws.send_json(message)
        print(f"Game ended in '{room.name}'. {winner.username} won by walkover.")

    async def end_game_and_show_results(self, room: Room):
        room.status = RoomStatus.FINISHED
        room.started = False
        
        scores = room.get_scores()
        
        winner_data = None
        is_tie = False
        
        if not scores:
            print(f"Game ended in room '{room.name}'. No players to determine a winner.")
        elif len(scores) == 1:
            winner_data = {"usernames": [scores[0]["username"]], "score": scores[0]["score"]}
            print(f"Game ended in room '{room.name}'. Winner: {scores[0]['username']}")
        else:
            highest_score = scores[0]["score"]
            winners = [player for player in scores if player["score"] == highest_score]
            
            if len(winners) > 1:
                is_tie = True
                winner_data = {"usernames": [w["username"] for w in winners], "score": highest_score}
                print(f"Game ended in room '{room.name}'. It's a tie between: {winner_data['usernames']}")
            else:
                winner_data = {"usernames": [winners[0]["username"]], "score": highest_score}
                print(f"Game ended in room '{room.name}'. Winner: {winners[0]['username']}")

        message = {
            "type": "game_over",
            "scores": scores,
            "winner_data": winner_data,
            "is_tie": is_tie
        }
        await self.broadcast_to_room(room, message)

    async def start_game_countdown(self, room: Room):
        if room.id in self.countdown_rooms or room.started:
            return

        print(f"Room '{room.name}' is full. Starting countdown.")
        self.countdown_rooms.add(room.id)

        try:
            for i in range(5, 0, -1):
                if room.id not in self.rooms or not room.is_full():
                    print(f"Countdown for room '{room.name}' aborted as a player left.")
                    return
                
                await self.broadcast_to_room(room, {
                    "type": "countdown",
                    "time": i,
                    "message": f"Game starting in {i}..."
                })
                await asyncio.sleep(1)

            if room.id in self.rooms and room.is_full() and not room.started:
                room.start_game()
                print(f"Game started in room '{room.name}'.")

                end_time = time.time() + room.time_left

                await self.broadcast_to_room(room, {
                    "type": "start_game",
                    "letterPool": room.letter_pool,
                    "duration": room.time_left,
                    "endTime": end_time,
                })

                asyncio.create_task(self.run_game_timer(room))

        finally:
            if room.id in self.countdown_rooms:
                self.countdown_rooms.remove(room.id)

    async def run_game_timer(self, room: Room):
        await asyncio.sleep(room.time_left)
        
        if room.status == RoomStatus.IN_PROGRESS:
            await self.end_game_and_show_results(room)
    
    async def broadcast_to_room(self, room: Room, message: dict):
        await room.broadcast(message)

manager = ConnectionManager()