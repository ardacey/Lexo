from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Optional
from pydantic import BaseModel
import uuid
import asyncio
import logging
from sqlalchemy.orm import Session
from models import Player
from services import MatchmakingService, WordService
from database import get_db
from db_services import UserService, UserStatsService, GameHistoryService

logger = logging.getLogger(__name__)
api_router = APIRouter()

def create_websocket_router(matchmaking_service: MatchmakingService, word_service: WordService):
    
    @api_router.websocket("/ws/queue")
    async def queue_websocket(websocket: WebSocket):
        await websocket.accept()
        player = None
        
        try:
            data = await websocket.receive_json()
            username = data.get("username", "Player")
            clerk_id = data.get("clerk_id")
            
            if not clerk_id:
                await websocket.send_json({
                    "type": "error",
                    "message": "Clerk ID is required"
                })
                await websocket.close()
                return
            
            player = Player(clerk_id, username, websocket)
            queue_position = matchmaking_service.add_to_queue(player)
            
            await websocket.send_json({
                "type": "queue_joined",
                "message": "Oyun aranıyor...",
                "player_id": clerk_id,
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
                            websocket, clerk_id, data, 
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
            logger.info(f"Player {clerk_id} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await handle_disconnect(player, clerk_id, matchmaking_service)
    
    return api_router


async def handle_match_found(room):
    match_message_p1 = {
        "type": "match_found",
        "room_id": room.id,
        "opponent": room.player2.username,
        "opponent_clerk_id": room.player2.id
    }
    match_message_p2 = {
        "type": "match_found",
        "room_id": room.id,
        "opponent": room.player1.username,
        "opponent_clerk_id": room.player1.id
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
        # Only notify opponent if game is still in progress (not ended)
        if not room.game_ended:
            opponent = room.get_opponent(player) if player else None
            if opponent:
                try:
                    await opponent.websocket.send_json({
                        "type": "opponent_disconnected",
                        "message": "Rakip oyundan ayrıldı"
                    })
                    logger.info(f"Notified opponent of early disconnect in room {room.id}")
                except Exception as e:
                    logger.error(f"Error notifying opponent of disconnect: {e}")
        else:
            logger.info(f"Game already ended in room {room.id}, skipping disconnect notification")
        
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


class ValidateWordRequest(BaseModel):
    word: str


class CreateUserRequest(BaseModel):
    clerk_id: str
    username: str
    email: Optional[str] = None


class SaveGameRequest(BaseModel):
    room_id: str
    player1_clerk_id: str
    player2_clerk_id: str
    player1_score: int
    player2_score: int
    player1_words: list
    player2_words: list
    winner_clerk_id: Optional[str] = None
    duration: int
    letter_pool: list
    started_at: str
    ended_at: str


def setup_api_routes(word_service: WordService):
    """Single player endpoints için word_service'i inject et"""
    
    @api_router.post("/api/validate-word")
    def validate_word(request: ValidateWordRequest):
        """Single player mode için kelime validasyonu"""
        word = request.word.strip().lower()
        
        if len(word) < 2:
            return {
                "valid": False,
                "message": "Kelime en az 2 harf olmalıdır"
            }
        
        is_valid = word_service.is_valid_word(word)
        
        return {
            "valid": is_valid,
            "message": "Geçerli bir Türkçe kelime" if is_valid else "Geçerli bir Türkçe kelime değil"
        }
    
    @api_router.post("/api/users")
    def create_user(request: CreateUserRequest, db: Session = Depends(get_db)):
        try:
            user = UserService.create_or_get_user(
                db, 
                request.clerk_id, 
                request.username, 
                request.email
            )
            stats = UserStatsService.get_user_stats(db, user.id)
            
            return {
                "success": True,
                "user": {
                    "id": user.id,
                    "clerk_id": user.clerk_id,
                    "username": user.username,
                    "email": user.email,
                    "created_at": user.created_at.isoformat()
                },
                "stats": {
                    "total_games": stats.total_games if stats else 0,
                    "wins": stats.wins if stats else 0,
                    "losses": stats.losses if stats else 0,
                    "ties": stats.ties if stats else 0,
                    "win_rate": stats.win_rate if stats else 0,
                    "highest_score": stats.highest_score if stats else 0,
                    "average_score": stats.average_score if stats else 0,
                    "total_words": stats.total_words if stats else 0,
                    "longest_word": stats.longest_word if stats else "",
                    "total_play_time": stats.total_play_time if stats else 0,
                    "current_win_streak": stats.current_win_streak if stats else 0,
                    "best_win_streak": stats.best_win_streak if stats else 0
                }
            }
        except Exception as e:
            logger.error(f"Error creating/getting user: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get("/api/users/{clerk_id}/stats")
    def get_user_stats(clerk_id: str, db: Session = Depends(get_db)):
        try:
            user = UserService.get_user_by_clerk_id(db, clerk_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            stats = UserStatsService.get_user_stats(db, user.id)
            rank = UserStatsService.get_user_rank(db, user.id)
            
            if not stats:
                return {
                    "success": True,
                    "stats": {
                        "total_games": 0,
                        "wins": 0,
                        "losses": 0,
                        "ties": 0,
                        "win_rate": 0,
                        "highest_score": 0,
                        "average_score": 0,
                        "total_words": 0,
                        "longest_word": "",
                        "total_play_time": 0,
                        "current_win_streak": 0,
                        "best_win_streak": 0,
                        "rank": None
                    }
                }
            
            return {
                "success": True,
                "stats": {
                    "total_games": stats.total_games,
                    "wins": stats.wins,
                    "losses": stats.losses,
                    "ties": stats.ties,
                    "win_rate": round(stats.win_rate, 2),
                    "highest_score": stats.highest_score,
                    "average_score": round(stats.average_score, 2),
                    "total_words": stats.total_words,
                    "longest_word": stats.longest_word,
                    "longest_word_length": stats.longest_word_length,
                    "total_play_time": stats.total_play_time,
                    "current_win_streak": stats.current_win_streak,
                    "best_win_streak": stats.best_win_streak,
                    "rank": rank
                }
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting user stats: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get("/api/users/{clerk_id}/games")
    def get_user_games(clerk_id: str, limit: int = 10, db: Session = Depends(get_db)):
        try:
            user = UserService.get_user_by_clerk_id(db, clerk_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            games = GameHistoryService.get_user_games(db, user.id, limit)
            
            games_list = []
            for game in games:
                # Determine if tied first
                tied = game.winner_id is None
                
                # Determine if user won (only if not tied)
                won = False
                if not tied and game.winner_id:
                    # Get the winner's clerk_id
                    if game.winner_id == game.player1_id:
                        winner = game.player1
                    else:
                        winner = game.player2
                    won = winner.clerk_id == clerk_id

                opponent_id = game.player2_id if game.player1_id == user.id else game.player1_id
                opponent = UserService.get_user_by_id(db, opponent_id)

                if game.player1_id == user.id:
                    user_score = game.player1_score
                    opponent_score = game.player2_score
                    user_words = game.player1_words
                else:
                    user_score = game.player2_score
                    opponent_score = game.player1_score
                    user_words = game.player2_words
                
                games_list.append({
                    "room_id": game.room_id,
                    "opponent": opponent.username if opponent else "Unknown",
                    "user_score": user_score,
                    "opponent_score": opponent_score,
                    "user_words": user_words,
                    "won": won,
                    "tied": tied,
                    "duration": game.duration,
                    "played_at": game.ended_at.isoformat()
                })
            
            return {
                "success": True,
                "games": games_list
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting user games: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.get("/api/leaderboard")
    def get_leaderboard(limit: int = 100, db: Session = Depends(get_db)):
        try:
            leaderboard = UserStatsService.get_leaderboard(db, limit)
            return {
                "success": True,
                "leaderboard": leaderboard
            }
        except Exception as e:
            logger.error(f"Error getting leaderboard: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @api_router.post("/api/games/save")
    def save_game(request: SaveGameRequest, db: Session = Depends(get_db)):
        try:
            from datetime import datetime

            player1 = UserService.get_user_by_clerk_id(db, request.player1_clerk_id)
            player2 = UserService.get_user_by_clerk_id(db, request.player2_clerk_id)
            
            if not player1:
                raise HTTPException(status_code=404, detail="Player 1 not found")
            if not player2:
                raise HTTPException(status_code=404, detail="Player 2 not found")

            winner_id = None
            if request.winner_clerk_id:
                winner = UserService.get_user_by_clerk_id(db, request.winner_clerk_id)
                if winner:
                    winner_id = winner.id

            started_at = datetime.fromisoformat(request.started_at.replace('Z', '+00:00'))
            ended_at = datetime.fromisoformat(request.ended_at.replace('Z', '+00:00'))
            
            game = GameHistoryService.create_game_history(
                db=db,
                room_id=request.room_id,
                player1_id=player1.id,
                player2_id=player2.id,
                player1_score=request.player1_score,
                player2_score=request.player2_score,
                player1_words=request.player1_words,
                player2_words=request.player2_words,
                winner_id=winner_id,
                duration=request.duration,
                letter_pool=request.letter_pool,
                started_at=started_at,
                ended_at=ended_at
            )

            player1_won = winner_id == player1.id if winner_id else False
            player1_tied = winner_id is None
            UserStatsService.update_stats_after_game(
                db=db,
                user_id=player1.id,
                score=request.player1_score,
                words=request.player1_words,
                won=player1_won,
                tied=player1_tied,
                game_duration=request.duration
            )

            player2_won = winner_id == player2.id if winner_id else False
            player2_tied = winner_id is None
            UserStatsService.update_stats_after_game(
                db=db,
                user_id=player2.id,
                score=request.player2_score,
                words=request.player2_words,
                won=player2_won,
                tied=player2_tied,
                game_duration=request.duration
            )
            
            return {
                "success": True,
                "message": "Game saved successfully",
                "game_id": game.id
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error saving game: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return api_router
