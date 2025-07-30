# api/websocket.py

import asyncio
import time
from typing import cast
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from core.database import SessionLocal
from game.manager import connection_manager, RoomService
from game.models_db import RoomStatus, PlayerDB

router = APIRouter()

async def game_ender(room_id: str, duration: int):
    await asyncio.sleep(duration)
    db = SessionLocal()
    service = RoomService(db)
    try:
        room = service.get_room(room_id)
        if room and room.status == RoomStatus.IN_PROGRESS: # type: ignore
            print(f"Game time is up for room {room_id}. Ending game.")
            _, result_data = service.end_game(room_id)
            await connection_manager.broadcast_to_room(room_id, {
                "type": "game_over", **result_data
            })
    except Exception as e:
        print(f"Error in game_ender for room {room_id}: {e}")
    finally:
        db.close()

@router.websocket("/ws/{room_id}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    player_id: str,
):
    db: Session = SessionLocal()
    service = RoomService(db)
    player: PlayerDB | None = None
    try:
        room = service.get_room(room_id)
        if not room:
            await websocket.accept()
            await websocket.close(code=4004, reason="Room not found")
            return
            
        player = next((p for p in room.players if p.id == player_id), None)
        if not player:
            await websocket.accept()
            await websocket.close(code=4004, reason="Player not found in this room.")
            return

        await connection_manager.connect(websocket, room_id, player_id)
        
        room_obj = service.get_room(room_id)
        player_usernames = [p.username for p in room_obj.players] if room_obj else []
        await connection_manager.broadcast_to_room(room_id, {
            "type": "player_joined", "players": player_usernames,
            "message": f"Player '{player.username}' has connected."
        })

        if len(player_usernames) == 2 and not service.get_room(room_id).started: # type: ignore
            for i in range(5, 0, -1):
                await connection_manager.broadcast_to_room(room_id, {"type": "countdown", "time": i, "message": f"Game starting in {i}..."})
                await asyncio.sleep(1)
            
            room_to_start = service.get_room(room_id)
            if room_to_start is not None:
                service.start_game_for_room(room_to_start)
                
                room_time_left = cast(int, room_to_start.time_left)
                room_letter_pool = cast(list, room_to_start.letter_pool)
                end_time = time.time() + room_time_left
                
                await connection_manager.broadcast_to_room(room_id, {
                    "type": "start_game", "letterPool": room_letter_pool,
                    "duration": room_time_left, "endTime": end_time
                })
                asyncio.create_task(game_ender(room_id, room_time_left))
            else:
                print(f"Error: room_to_start is None for room_id {room_id}")

    except Exception as e:
        print(f"Error during WebSocket connection setup for player {player_id}: {e}")
    finally:
        db.close()

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "word":
                word = data.get("word", "")
                
                word_db = SessionLocal()
                try:
                    word_service = RoomService(word_db)
                    is_successful, response_data = word_service.process_word(room_id, player_id, word)

                    if not is_successful:
                        await websocket.send_json(response_data)
                    else:
                        await websocket.send_json({
                            "type": "word_result", "valid": True, "word": response_data["word"],
                            "score": response_data["score"], "totalScore": response_data["player_total_score"],
                            "letterPool": response_data["new_letter_pool"], "scores": response_data["current_scores"],
                        })
                        
                        opponent_message = {
                            "type": "opponent_word", "word": response_data["word"],
                            "score": response_data["score"], "letterPool": response_data["new_letter_pool"],
                            "scores": response_data["current_scores"],
                        }
                        if room_id in connection_manager.active_connections:
                            for opponent_id, ws in connection_manager.active_connections[room_id].items():
                                if opponent_id != player_id:
                                    await ws.send_json(opponent_message)
                finally:
                    word_db.close()

    except WebSocketDisconnect:
        print(f"Player {player_id} disconnected from room {room_id}")
        disconnect_db = SessionLocal()
        try:
            disconnect_service = RoomService(disconnect_db)
            remaining_room, leaving_player, walkover = disconnect_service.handle_disconnect(room_id, player_id)
            
            if leaving_player:
                message_text = f"Player '{leaving_player.username}' has left."
                if walkover and remaining_room and remaining_room.players:
                    winner = remaining_room.players[0]
                    await connection_manager.broadcast_to_room(room_id, {
                        "type": "game_over", "is_tie": False,
                        "winner_data": {"usernames": [winner.username], "score": winner.score},
                        "scores": [{"username": p.username, "score": p.score} for p in remaining_room.players],
                        "reason": f"You won! {leaving_player.username} left the game."
                    })
                elif remaining_room:
                    await connection_manager.broadcast_to_room(room_id, {
                        "type": "player_left", "players": [p.username for p in remaining_room.players],
                        "message": message_text
                    })
        finally:
            disconnect_db.close()

    finally:
        connection_manager.disconnect(room_id, player_id)
        print(f"Connection manager cleaned up for player {player_id}")