from fastapi import WebSocket, WebSocketDisconnect
from typing import Optional, Dict
import asyncio
from datetime import datetime

from app.models.domain import Player, GameRoom
from app.services.matchmaking_service import MatchmakingService
from app.services.word_service import WordService
from app.services.user_service import UserService
from app.services.stats_service import StatsService
from app.services.game_history_service import GameHistoryService
from app.database.session import get_db
from app.core.logging import get_logger
from app.websocket.auth import (
    authenticate_websocket,
    WebSocketAuthError,
    RateLimiter,
    validate_message,
    send_error_response
)

logger = get_logger(__name__)


class GameWebSocketHandler:
    
    def __init__(
        self,
        matchmaking_service: MatchmakingService,
        word_service: WordService
    ):
        self.matchmaking_service = matchmaking_service
        self.word_service = word_service
        # Rate limiter for message throttling (30 messages per 10 seconds)
        self.rate_limiters: Dict[str, RateLimiter] = {}
    
    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()
        player = None
        clerk_id = None
        
        try:
            # Authenticate the WebSocket connection
            try:
                user_data = await authenticate_websocket(websocket)
                clerk_id = user_data["clerk_id"]
                username = user_data.get("username", "Player")
                logger.info(f"Authenticated user {clerk_id} connected")
            except WebSocketAuthError as e:
                logger.warning(f"Authentication failed: {e}")
                await send_error_response(
                    websocket,
                    "authentication_failed",
                    "Authentication failed"
                )
                await websocket.close()
                return
            
            # Initialize rate limiter for this user
            if clerk_id not in self.rate_limiters:
                self.rate_limiters[clerk_id] = RateLimiter()
            
            # Get initial connection data
            data = await websocket.receive_json()
            is_reconnect = data.get("is_reconnect", False)
            
            existing_room = self.matchmaking_service.get_room_by_player(clerk_id)
            if existing_room and existing_room.game_started and not existing_room.game_ended:
                logger.info(f"Player {clerk_id} reconnecting to existing game {existing_room.id}")
                
                time_remaining = existing_room.get_time_remaining()
                if time_remaining and time_remaining > 0:
                    existing_player = existing_room.get_player(clerk_id)
                    if existing_player:
                        existing_player.websocket = websocket
                        existing_player.connected = True
                        existing_player.last_disconnect_time = None
                        
                        opponent = existing_room.get_opponent(existing_player)
                        
                        await websocket.send_json({
                            "type": "reconnected",
                            "room_id": existing_room.id,
                            "opponent": opponent.username,
                            "opponent_clerk_id": opponent.id,
                            "letter_pool": existing_room.letter_pool,
                            "scores": existing_room.get_scores(),
                            "time_remaining": time_remaining,
                            "my_words": existing_player.words,
                            "used_words": list(existing_room.used_words)
                        })
                        
                        if opponent and opponent.connected:
                            try:
                                await opponent.websocket.send_json({
                                    "type": "opponent_reconnected",
                                    "message": "Rakip oyuna geri döndü"
                                })
                            except Exception as e:
                                logger.error(f"Error notifying opponent of reconnection: {e}")
                        
                        logger.info(f"Player {clerk_id} successfully reconnected to game {existing_room.id}")
                        player = existing_player
                    else:
                        logger.error(f"Could not find player {clerk_id} in room {existing_room.id}")
                else:
                    logger.info(f"Game {existing_room.id} time expired, cleaning up")
                    existing_room.end_game()
                    self.matchmaking_service.cleanup_room(existing_room.id)
                    
                    await websocket.send_json({
                        "type": "game_expired",
                        "message": "Oyun süresi doldu"
                    })
                    await websocket.close()
                    return
            else:
                player = Player(clerk_id, username, websocket)
                queue_position = self.matchmaking_service.add_to_queue(player)
                
                await websocket.send_json({
                    "type": "queue_joined",
                    "message": "Oyun aranıyor...",
                    "player_id": clerk_id,
                    "queue_position": queue_position
                })
                
                room = self.matchmaking_service.try_match_players()
                if room:
                    await self._handle_match_found(room)
            
            while True:
                try:
                    data = await asyncio.wait_for(
                        websocket.receive_json(),
                        timeout=30.0
                    )
                    
                    # Validate message structure
                    validation_error = validate_message(data)
                    if validation_error:
                        logger.warning(f"Invalid message from {clerk_id}: {validation_error}")
                        await send_error_response(
                            websocket,
                            "invalid_message",
                            "Invalid message format"
                        )
                        continue
                    
                    # Check rate limit
                    rate_limiter = self.rate_limiters.get(clerk_id)
                    if rate_limiter and not rate_limiter.check_rate_limit(clerk_id):
                        logger.warning(f"Rate limit exceeded for {clerk_id}")
                        await send_error_response(
                            websocket,
                            "rate_limit_exceeded",
                            "Too many messages, please slow down"
                        )
                        continue
                    
                    message_type = data.get("type")
                    
                    if message_type not in ["ping"]:
                        logger.info(f"📨 Received message type: {message_type} from {clerk_id}")
                    
                    if message_type == "submit_word":
                        await self._handle_word_submission(
                            websocket, clerk_id, data, username
                        )
                    elif message_type == "send_emoji":
                        logger.info(f"🎭 send_emoji message received, calling handler")
                        await self._handle_emoji_message(
                            websocket, clerk_id, data, username
                        )
                    elif message_type == "ping":
                        await websocket.send_json({"type": "pong"})
                
                except asyncio.TimeoutError:
                    try:
                        await websocket.send_json({"type": "ping"})
                    except:
                        logger.warning(f"Client {clerk_id} not responding to ping")
                        break
                except WebSocketDisconnect:
                    logger.info(f"Client {clerk_id} disconnected normally")
                    break
                except Exception as e:
                    logger.error(f"Error processing message from {clerk_id}: {e}")
                    break
        
        except WebSocketDisconnect:
            logger.info(f"Player {clerk_id if player else 'unknown'} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await self._handle_disconnect(player, clerk_id if player else None)
    
    async def _handle_match_found(self, room: GameRoom):
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
        
        await self._start_game_countdown(room)
    
    async def _start_game_countdown(self, room: GameRoom):
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
            
            asyncio.create_task(self._end_game_after_duration(room))
        except Exception as e:
            logger.error(f"Error starting game: {e}")
    
    async def _end_game_after_duration(self, room: GameRoom):
        await asyncio.sleep(room.duration)
        
        if not room.game_ended:
            room.end_game()
            winner = room.get_winner()
            
            end_message = {
                "type": "game_end",
                "winner": winner,
                "scores": room.get_scores(),
                "is_tie": winner is None,
                "game_saved_by_server": True
            }
            
            if room.player1.connected:
                try:
                    await room.player1.websocket.send_json(end_message)
                    logger.info(f"Game end message sent to player1 in room {room.id}")
                except Exception as e:
                    logger.error(f"Error sending game end to player1: {e}")
            else:
                logger.info(f"Player1 not connected, skipping game end message")
            
            if room.player2.connected:
                try:
                    await room.player2.websocket.send_json(end_message)
                    logger.info(f"Game end message sent to player2 in room {room.id}")
                except Exception as e:
                    logger.error(f"Error sending game end to player2: {e}")
            else:
                logger.info(f"Player2 not connected, skipping game end message")
            
            logger.info(f"Game ended in room {room.id}, winner: {winner}")
            await self._save_game_to_database(room, winner)
    
    async def _handle_word_submission(
        self,
        websocket: WebSocket,
        player_id: str,
        data: Dict,
        username: str
    ):
        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            return
        
        word = data.get("word", "").strip()
        player = room.get_player(player_id)
        
        if not player:
            return

        validation = self.matchmaking_service.game_service.validate_word_submission(
            room, word
        )
        
        if not validation['valid']:
            await websocket.send_json({
                "type": "word_invalid",
                "message": validation['message']
            })
            return

        result = self.matchmaking_service.game_service.process_word_submission(
            room, player, word
        )
        
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
    
    async def _handle_emoji_message(
        self,
        websocket: WebSocket,
        player_id: str,
        data: Dict,
        username: str
    ):
        logger.info(f"📨 Received emoji message from {username} ({player_id})")
        
        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            logger.warning(f"❌ No room found for player {player_id} trying to send emoji")
            await websocket.send_json({
                "type": "emoji_error",
                "message": "Rakip oyundan ayrıldı"
            })
            return
        
        logger.info(f"✅ Room found: {room.id}, game_ended: {room.game_ended}, game_started: {room.game_started}")
        
        if room.game_ended:
            logger.warning(f"❌ Game already ended in room {room.id}")
            await websocket.send_json({
                "type": "emoji_error",
                "message": "Oyun sona erdi"
            })
            return
        
        emoji = data.get("emoji", "")
        if not emoji:
            logger.warning(f"❌ Empty emoji received from player {player_id}")
            return
        
        logger.info(f"📤 Processing emoji: {emoji}")
        
        player = room.get_player(player_id)
        opponent = room.get_opponent(player)
        
        if not opponent:
            logger.warning(f"❌ No opponent found for player {player_id}")
            return
            
        logger.info(f"👤 Opponent found: {opponent.username} ({opponent.id})")
        
        try:
            await opponent.websocket.send_json({
                "type": "emoji_received",
                "emoji": emoji,
                "from": username,
                "timestamp": datetime.now().isoformat()
            })
            logger.info(f"✅ Emoji '{emoji}' sent from {username} to {opponent.username} in room {room.id}")
        except Exception as e:
            logger.error(f"❌ Error sending emoji to opponent: {e}")
    
    async def _handle_grace_period_timeout(self, room: GameRoom, player_id: str):
        remaining_time = room.get_time_remaining()
        if remaining_time and remaining_time > 0:
            logger.info(f"Waiting {remaining_time} seconds (remaining game time) for player {player_id} to reconnect")
            await asyncio.sleep(remaining_time)
        else:
            logger.info(f"No time remaining in game, ending immediately")

        disconnected_player = room.get_player(player_id)
        if disconnected_player and not disconnected_player.connected:
            logger.info(f"Player {player_id} did not reconnect within grace period")
            
            if not room.game_ended:
                room.end_game()
                opponent = room.get_opponent(disconnected_player)
                winner = opponent.username if opponent else None

                end_message = {
                    "type": "opponent_disconnected",
                    "message": "Rakip oyundan ayrıldı. Siz kazandınız!"
                }

                if opponent and opponent.connected:
                    try:
                        await opponent.websocket.send_json(end_message)
                        logger.info(f"Notified opponent {opponent.id} of disconnect win")
                    except Exception as e:
                        logger.error(f"Error notifying opponent of win: {e}")

                await self._save_game_to_database(room, winner)
            else:
                logger.info(f"Game already ended in room {room.id}, skipping duplicate end")

            self.matchmaking_service.cleanup_room(room.id)
            logger.info(f"Room {room.id} cleaned up after grace period timeout")
    
    async def _save_game_to_database(self, room: GameRoom, winner_name: Optional[str]):
        if room.game_saved:
            logger.info(f"Game {room.id} already saved, skipping")
            return
        
        try:
            room.game_saved = True
            
            db = next(get_db())
            try:
                user_service = UserService(db)
                stats_service = StatsService(db)
                game_history_service = GameHistoryService(db)

                player1 = user_service.get_user_by_clerk_id(room.player1.id)
                player2 = user_service.get_user_by_clerk_id(room.player2.id)
                
                if not player1 or not player2:
                    logger.error(f"Cannot save game {room.id}: Player not found in database")
                    return

                winner_id = None
                if winner_name:
                    if winner_name == room.player1.username:
                        winner_id = player1.id
                    elif winner_name == room.player2.username:
                        winner_id = player2.id

                game_history_service.create_game_history(
                    room_id=room.id,
                    player1_id=player1.id,
                    player2_id=player2.id,
                    player1_score=room.player1.score,
                    player2_score=room.player2.score,
                    player1_words=room.player1.words,
                    player2_words=room.player2.words,
                    winner_id=winner_id,
                    duration=room.duration,
                    letter_pool=room.letter_pool,
                    started_at=room.start_time or datetime.now(),
                    ended_at=datetime.now()
                )

                player1_won = winner_id == player1.id if winner_id else False
                player1_tied = winner_id is None
                stats_service.update_stats_after_game(
                    user_id=player1.id,
                    score=room.player1.score,
                    words=room.player1.words,
                    won=player1_won,
                    tied=player1_tied,
                    game_duration=room.duration
                )

                player2_won = winner_id == player2.id if winner_id else False
                player2_tied = winner_id is None
                stats_service.update_stats_after_game(
                    user_id=player2.id,
                    score=room.player2.score,
                    words=room.player2.words,
                    won=player2_won,
                    tied=player2_tied,
                    game_duration=room.duration
                )
                
                logger.info(f"Successfully saved game {room.id} to database")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error saving game {room.id} to database: {e}")
            room.game_saved = False
    
    async def _handle_disconnect(self, player: Optional[Player], player_id: Optional[str]):
        if not player_id:
            return
        
        # Clean up rate limiter for disconnected player
        if player_id in self.rate_limiters:
            del self.rate_limiters[player_id]
            logger.info(f"Cleaned up rate limiter for player {player_id}")
        
        logger.info(f"Handling disconnect for player {player_id}")

        if player:
            self.matchmaking_service.remove_from_queue(player)
            logger.info(f"Removed player {player_id} from queue")

        room = self.matchmaking_service.get_room_by_player(player_id)
        if room:
            logger.info(f"Found room {room.id} for disconnecting player {player_id}")
            
            if not room.game_ended and room.game_started:
                disconnected_player = room.get_player(player_id)
                if disconnected_player:
                    disconnected_player.connected = False
                    disconnected_player.last_disconnect_time = datetime.now()
                    logger.info(f"Player {player_id} marked as disconnected, starting grace period")
                
                opponent = room.get_opponent(disconnected_player) if disconnected_player else None
                
                if opponent:
                    try:
                        await opponent.websocket.send_json({
                            "type": "opponent_disconnected_temp",
                            "message": "Rakip bağlantısı kesildi, tekrar bağlanması bekleniyor..."
                        })
                        logger.info(f"Notified opponent {opponent.id} of temporary disconnect")
                    except Exception as e:
                        logger.error(f"Error notifying opponent {opponent.id}: {e}")

                asyncio.create_task(self._handle_grace_period_timeout(room, player_id))
            elif not room.game_started:
                self.matchmaking_service.cleanup_room(room.id)
                logger.info(f"Cleaned up room {room.id} (game not started)")
            else:
                logger.info(f"Game already ended in room {room.id}, skipping disconnect notification")
                self.matchmaking_service.cleanup_room(room.id)
