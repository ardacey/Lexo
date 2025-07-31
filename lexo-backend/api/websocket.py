import asyncio
import time
from datetime import datetime
from typing import cast
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from core.database import SessionLocal
from game.manager import connection_manager, RoomService
from game.models_db import RoomStatus, PlayerDB

router = APIRouter()

async def countdown_handler(room_id: str):
    db = SessionLocal()
    service = RoomService(db)
    try:
        room = service.get_room(room_id)
        if room:
            setattr(room, 'status', RoomStatus.COUNTDOWN)
            db.commit()
            
        for i in range(5, 0, -1):
            await connection_manager.broadcast_to_room(room_id, {
                "type": "countdown", 
                "time": i, 
                "message": f"Game starting in {i}..."
            })
            await asyncio.sleep(1)
        
        room_to_start = service.get_room(room_id)
        if room_to_start and service.start_game_for_room(room_to_start):
            room_time_left = cast(int, room_to_start.time_left)
            room_letter_pool = cast(list, room_to_start.letter_pool)
            end_time = time.time() + room_time_left
            
            await connection_manager.broadcast_to_room(room_id, {
                "type": "start_game", 
                "letterPool": room_letter_pool,
                "duration": room_time_left, 
                "endTime": end_time
            })
            
            asyncio.create_task(game_ender(room_id, room_time_left))
        else:
            print(f"Failed to start game for room {room_id}")
            
    except Exception as e:
        print(f"Error in countdown_handler for room {room_id}: {e}")
    finally:
        db.close()

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
    player = None
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

        connection_success = await connection_manager.connect(websocket, room_id, player_id)
        if not connection_success:
            return
        
        room_obj = service.get_room(room_id)
        if room_obj:
            active_players = [p for p in room_obj.players if not p.is_viewer]
            all_players = [p.username for p in room_obj.players]
            remaining_time = 0
            end_time = None
            is_game_started = getattr(room_obj, 'started', False)
            room_status = getattr(room_obj, 'status', RoomStatus.WAITING)
            if room_status == RoomStatus.IN_PROGRESS and is_game_started:
                game_start_time = getattr(room_obj, 'game_start_time', None)
                if game_start_time:
                    elapsed_seconds = (datetime.now() - game_start_time).total_seconds()
                    remaining_time = max(0, 120 - int(elapsed_seconds))
                    end_time = time.time() + remaining_time
                else:
                    remaining_time = room_obj.time_left or 0
                    end_time = time.time() + remaining_time
            
            player_words = {}
            if getattr(player, 'is_viewer', False) and is_game_started:
                for p in active_players:
                    player_words[p.username] = p.words or []
            
            await websocket.send_json({
                "type": "room_state",
                "room_status": room_status.value,
                "players": all_players,
                "active_players": [p.username for p in active_players],
                "is_viewer": getattr(player, 'is_viewer', False),
                "letter_pool": room_obj.letter_pool if is_game_started else [],
                "scores": [{"username": p.username, "score": p.score} for p in active_players] if is_game_started else [],
                "game_started": is_game_started,
                "time_left": remaining_time,
                "end_time": end_time,
                "used_words": room_obj.used_words if is_game_started else [],
                "player_words": player_words
            })
            
            await connection_manager.broadcast_to_room(room_id, {
                "type": "player_joined", 
                "players": all_players,
                "message": f"{'Viewer' if getattr(player, 'is_viewer', False) else 'Player'} '{player.username}' has connected."
            })

            if (len(active_players) == 2 and 
                room_status == RoomStatus.WAITING and 
                not is_game_started):
                
                asyncio.create_task(countdown_handler(room_id))

    except Exception as e:
        print(f"Error during WebSocket connection setup for player {player_id}: {e}")
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=1011, reason="Internal server error")
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
                            "type": "word_result", 
                            "valid": True, 
                            "word": response_data["word"],
                            "score": response_data["score"], 
                            "totalScore": response_data["player_total_score"],
                            "letterPool": response_data["new_letter_pool"], 
                            "scores": response_data["current_scores"],
                        })
                        
                        opponent_message = {
                            "type": "opponent_word", 
                            "word": response_data["word"],
                            "score": response_data["score"], 
                            "letterPool": response_data["new_letter_pool"],
                            "scores": response_data["current_scores"],
                        }
                        if room_id in connection_manager.active_connections:
                            player_info = word_service.get_player(player_id)
                            player_username = player_info.username if player_info else "Unknown"
                            
                            for opponent_id, ws in connection_manager.active_connections[room_id].items():
                                if opponent_id != player_id:
                                    try:
                                        opponent_player = word_service.get_player(opponent_id)
                                        if opponent_player and getattr(opponent_player, 'is_viewer', False):
                                            await ws.send_json({
                                                "type": "player_word",
                                                "player": player_username,
                                                "word": response_data["word"],
                                                "score": response_data["score"],
                                                "letterPool": response_data["new_letter_pool"],
                                                "scores": response_data["current_scores"],
                                            })
                                        else:
                                            await ws.send_json(opponent_message)
                                    except Exception:
                                        pass
                finally:
                    word_db.close()

    except WebSocketDisconnect:
        print(f"Player {player_id} disconnected from room {room_id}")
        disconnect_db = SessionLocal()
        try:
            disconnect_service = RoomService(disconnect_db)
            remaining_room, leaving_player, walkover = disconnect_service.handle_disconnect(room_id, player_id)
            
            if leaving_player:
                is_leaving_viewer = getattr(leaving_player, 'is_viewer', False)
                message_text = f"{'Viewer' if is_leaving_viewer else 'Player'} '{leaving_player.username}' has left."
                
                if walkover and remaining_room and remaining_room.players:
                    winners = [p for p in remaining_room.players if not p.is_viewer]
                    if winners:
                        winner = winners[0]
                        await connection_manager.broadcast_to_room(room_id, {
                            "type": "game_over", 
                            "is_tie": False,
                            "winner_data": {"usernames": [winner.username], "score": winner.score},
                            "scores": [{"username": p.username, "score": p.score} for p in winners],
                            "reason": f"{winner.username} won! {leaving_player.username} left the game."
                        })
                elif remaining_room:
                    all_players = [p.username for p in remaining_room.players]
                    await connection_manager.broadcast_to_room(room_id, {
                        "type": "player_left", 
                        "players": all_players,
                        "message": message_text
                    })
        finally:
            disconnect_db.close()

    except Exception as e:
        print(f"Unexpected error in websocket for player {player_id}: {e}")
    finally:
        connection_manager.disconnect(room_id, player_id)
        print(f"Connection manager cleaned up for player {player_id}")