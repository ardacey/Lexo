from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import uuid
import asyncio
import logging
from models import Player
from services import MatchmakingService, WordService

logger = logging.getLogger(__name__)
api_router = APIRouter()

def create_websocket_router(matchmaking_service: MatchmakingService, word_service: WordService):
    
    @api_router.websocket("/ws/queue")
    async def queue_websocket(websocket: WebSocket):
        await websocket.accept()
        player_id = str(uuid.uuid4())
        player = None
        
        try:
            data = await websocket.receive_json()
            username = data.get("username", "Player")
            
            player = Player(player_id, username, websocket)
            queue_position = matchmaking_service.add_to_queue(player)
            
            await websocket.send_json({
                "type": "queue_joined",
                "message": "Oyun aranıyor...",
                "player_id": player_id,
                "queue_position": queue_position
            })
            
            room = matchmaking_service.try_match_players()
            if room:
                await handle_match_found(room)
            
            while True:
                try:
                    data = await websocket.receive_json()
                    message_type = data.get("type")
                    
                    if message_type == "submit_word":
                        await handle_word_submission(
                            websocket, player_id, data, 
                            matchmaking_service, username
                        )
                    
                    elif message_type == "ping":
                        await websocket.send_json({"type": "pong"})
                    
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    break
        
        except WebSocketDisconnect:
            logger.info(f"Player {player_id} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await handle_disconnect(player, player_id, matchmaking_service)
    
    return api_router


async def handle_match_found(room):
    match_message_p1 = {
        "type": "match_found",
        "room_id": room.id,
        "opponent": room.player2.username
    }
    match_message_p2 = {
        "type": "match_found",
        "room_id": room.id,
        "opponent": room.player1.username
    }
    
    await room.player1.websocket.send_json(match_message_p1)
    await room.player2.websocket.send_json(match_message_p2)
    
    logger.info(f"Notified players about match in room {room.id}")
    
    await start_game_countdown(room)


async def start_game_countdown(room):
    await asyncio.sleep(1)
    room.start_game()
    
    start_message = {
        "type": "game_start",
        "letter_pool": room.letter_pool,
        "duration": room.duration,
        "scores": room.get_scores()
    }
    
    try:
        await room.player1.websocket.send_json(start_message)
        await room.player2.websocket.send_json(start_message)
        logger.info(f"Game started in room {room.id}")
        
        asyncio.create_task(end_game_after_duration(room))
    except Exception as e:
        logger.error(f"Error starting game: {e}")


async def end_game_after_duration(room):
    await asyncio.sleep(room.duration)
    
    if not room.game_ended:
        room.end_game()
        winner = room.get_winner()
        
        end_message = {
            "type": "game_end",
            "winner": winner,
            "scores": room.get_scores(),
            "is_tie": winner is None
        }
        
        try:
            await room.player1.websocket.send_json(end_message)
            await room.player2.websocket.send_json(end_message)
            logger.info(f"Game ended in room {room.id}, winner: {winner}")
        except Exception as e:
            logger.error(f"Error ending game: {e}")


async def handle_word_submission(websocket: WebSocket, player_id: str, data: Dict, 
                                 matchmaking_service: MatchmakingService, username: str):
    room = matchmaking_service.get_room_by_player(player_id)
    if not room:
        return
    
    word = data.get("word", "").strip()
    player = room.get_player(player_id)
    
    if not player:
        return
    
    validation = matchmaking_service.game_service.validate_word_submission(room, word)
    
    if not validation['valid']:
        await websocket.send_json({
            "type": "word_invalid",
            "message": validation['message']
        })
        return
    
    result = matchmaking_service.game_service.process_word_submission(room, player, word)
    
    await websocket.send_json({
        "type": "word_valid",
        "word": result['word'],
        "score": result['score'],
        "total_score": result['total_score'],
        "letter_pool": result['letter_pool'],
        "scores": result['scores']
    })
    
    opponent = room.get_opponent(player)
    try:
        await opponent.websocket.send_json({
            "type": "opponent_word",
            "player": username,
            "word": result['word'],
            "score": result['score'],
            "letter_pool": result['letter_pool'],
            "scores": result['scores']
        })
    except Exception as e:
        logger.error(f"Error notifying opponent: {e}")


async def handle_disconnect(player, player_id: str, matchmaking_service: MatchmakingService):
    if player:
        matchmaking_service.remove_from_queue(player)
    
    room = matchmaking_service.get_room_by_player(player_id)
    if room:
        opponent = room.get_opponent(player) if player else None
        if opponent:
            try:
                await opponent.websocket.send_json({
                    "type": "opponent_disconnected",
                    "message": "Rakip oyundan ayrıldı"
                })
            except Exception as e:
                logger.error(f"Error notifying opponent of disconnect: {e}")
        
        matchmaking_service.cleanup_room(room.id)


@api_router.get("/")
def read_root():
    return {
        "message": "Lexo Multiplayer API",
        "status": "running"
    }


@api_router.get("/stats")
def get_stats():
    return {
        "status": "running",
        "endpoints": ["GET /", "GET /stats", "GET /health", "WS /ws/queue", "WS /ws/game/{room_id}"]
    }


@api_router.get("/health")
def health_check():
    return {"status": "healthy"}
