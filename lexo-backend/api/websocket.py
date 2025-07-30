from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from game.manager import manager
from game import services
from game.word_list import is_word_valid
from game.logic import calculate_score, has_letters_in_pool, generate_letter_pool
import asyncio

router = APIRouter()

@router.websocket("/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    username: str = Query(..., min_length=2, max_length=20)
):
    try:
        room, player = await manager.connect(websocket, room_id, username)
    except ValueError as e:
        await websocket.accept()
        await websocket.close(code=4000, reason=str(e))
        return

    await manager.broadcast_to_room(room, {
        "type": "player_joined",
        "message": f"Player '{player.username}' has joined the room.",
        "players": [p.username for p in room.players.values()]
    })

    try:
        await websocket.send_json({
            "type": "init",
            "playerId": player.id,
            "username": player.username,
            "players": [p.username for p in room.players.values()],
            "message": f"Welcome, {player.username}! You've joined room '{room.name}'."
        })

        if room.is_full() and not room.started:
            asyncio.create_task(manager.start_game_countdown(room))

        while True:
            data = await websocket.receive_json()

            if data["type"] == "word":
                word = data.get("word", "")

                is_successful, response_data = services.process_word_submission(
                    room=room,
                    player=player,
                    word=word
                )

                if not is_successful:
                    await websocket.send_json(response_data)
                else:
                    await websocket.send_json({
                        "type": "word_result",
                        "word": response_data["word"],
                        "valid": True,
                        "score": response_data["score"],
                        "totalScore": response_data["player_total_score"],
                        "letterPool": response_data["new_letter_pool"],
                        "scores": response_data["current_scores"],
                    })

                    for opponent in room.get_opponents(player):
                        await opponent.ws.send_json({
                            "type": "opponent_word",
                            "word": response_data["word"],
                            "score": response_data["score"],
                            "letterPool": response_data["new_letter_pool"],
                            "scores": response_data["current_scores"],
                        })


    except WebSocketDisconnect:
        await manager.disconnect(room, player)
        await manager.broadcast_to_room(room, {
            "type": "player_left",
            "message": f"Player '{player.username}' has left the room.",
            "players": [p.username for p in room.players.values()]
        })