from fastapi import WebSocket, WebSocketDisconnect
from typing import Optional, Dict
import asyncio
from datetime import datetime
import time
import uuid

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
        user_id = None
        
        try:
            # Authenticate the WebSocket connection
            try:
                user_data = await authenticate_websocket(websocket)
                user_id = user_data["user_id"]
                username = user_data.get("username", "Player")
                is_reconnect = user_data.get("is_reconnect", False)
                initial_data = user_data.get("initial_data") or {}
            except WebSocketAuthError as e:
                logger.warning(f"Authentication failed: {e}")
                await send_error_response(
                    websocket,
                    "authentication_failed",
                    str(e)
                )
                await websocket.close()
                return
            
            # Initialize rate limiter for this user
            if user_id not in self.rate_limiters:
                self.rate_limiters[user_id] = RateLimiter()
            
            # Use data from authentication
            # No need to receive another message since authenticate_websocket already got it
            
            existing_room = self.matchmaking_service.get_room_by_player(user_id)
            if existing_room and existing_room.game_started and not existing_room.game_ended:
                logger.info(f"Player {user_id} reconnecting to existing game {existing_room.id}")
                
                time_remaining = existing_room.get_time_remaining()
                if time_remaining and time_remaining > 0:
                    existing_player = existing_room.get_player(user_id)
                    if existing_player:
                        existing_player.websocket = websocket
                        existing_player.connected = True
                        existing_player.last_disconnect_time = None
                        
                        opponent = existing_room.get_opponent(existing_player)
                        
                        await websocket.send_json({
                            "type": "reconnected",
                            "room_id": existing_room.id,
                            "opponent": opponent.username,
                            "opponent_user_id": opponent.id,
                            "letter_pool": existing_room.letter_pool,
                            "scores": existing_room.get_scores(),
                            "time_remaining": time_remaining,
                            "server_start_time": int(existing_room.start_time.timestamp() * 1000) if existing_room.start_time else None,
                            "duration": existing_room.duration,
                            "server_time": int(time.time() * 1000),
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
                        
                        logger.info(f"Player {user_id} successfully reconnected to game {existing_room.id}")
                        player = existing_player
                        self.matchmaking_service.register_player(existing_player)
                    else:
                        logger.error(f"Could not find player {user_id} in room {existing_room.id}")
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
                player = Player(user_id, username, websocket)
                self.matchmaking_service.register_player(player)
                if initial_data.get("mode") == "friend":
                    invite_id = initial_data.get("invite_id")
                    await websocket.send_json({
                        "type": "queue_joined",
                        "message": "Arkadaş maçına bağlanılıyor...",
                        "player_id": user_id,
                        "queue_position": None
                    })
                    if invite_id:
                        room = self.matchmaking_service.mark_invite_join(invite_id, player)
                        if room:
                            await self._handle_match_found(room)
                else:
                    queue_position = self.matchmaking_service.add_to_queue(player)
                    
                    await websocket.send_json({
                        "type": "queue_joined",
                        "message": "Oyun aranıyor...",
                        "player_id": user_id,
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
                    is_valid = validate_message(data)
                    if not is_valid:
                        logger.warning(f"Invalid message from {user_id}: {data}")
                        await send_error_response(
                            websocket,
                            "invalid_message",
                            "Invalid message format"
                        )
                        continue
                    
                    # Check rate limit
                    rate_limiter = self.rate_limiters.get(user_id)
                    if rate_limiter and not rate_limiter.is_allowed(user_id):
                        logger.warning(f"Rate limit exceeded for {user_id}")
                        await send_error_response(
                            websocket,
                            "rate_limit_exceeded",
                            "Too many messages, please slow down"
                        )
                        continue
                    
                    message_type = data.get("type")
                    

                    
                    if message_type == "submit_word":
                        await self._handle_word_submission(
                            websocket, user_id, data, username
                        )
                    elif message_type == "send_emoji":
                        await self._handle_emoji_message(
                            websocket, user_id, data, username
                        )
                    elif message_type == "friend_invite":
                        await self._handle_friend_invite(user_id, username, data)
                    elif message_type == "friend_invite_response":
                        await self._handle_friend_invite_response(user_id, data)
                    elif message_type == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "client_time": data.get("client_time"),
                            "server_time": int(time.time() * 1000)
                        })
                
                except asyncio.TimeoutError:
                    try:
                        await websocket.send_json({"type": "ping"})
                    except:
                        logger.warning(f"Client {user_id} not responding to ping")
                        break
                except WebSocketDisconnect:
                    logger.info(f"Client {user_id} disconnected normally")
                    break
                except Exception as e:
                    logger.error(f"Error processing message from {user_id}: {e}")
                    break
        
        except WebSocketDisconnect:
            logger.info(f"Player {user_id if player else 'unknown'} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error: {e}")
        finally:
            await self._handle_disconnect(player, user_id if player else None)
    
    async def _handle_match_found(self, room: GameRoom):
        match_message_p1 = {
            "type": "match_found",
            "room_id": room.id,
            "opponent": room.player2.username,
            "opponent_user_id": room.player2.id
        }
        match_message_p2 = {
            "type": "match_found",
            "room_id": room.id,
            "opponent": room.player1.username,
            "opponent_user_id": room.player1.id
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
            "scores": room.get_scores(),
            "server_start_time": int(room.start_time.timestamp() * 1000) if room.start_time else None,
            "server_time": int(time.time() * 1000)
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

    async def _handle_friend_invite(self, user_id: str, username: str, data: Dict):
        target_user_id = data.get("target_user_id")
        if not target_user_id or target_user_id == user_id:
            inviter_player = self.matchmaking_service.get_connected_player(user_id)
            if inviter_player:
                await send_error_response(inviter_player.websocket, "Geçersiz arkadaş daveti")
            return

        if self.matchmaking_service.get_invite_for_user(user_id):
            inviter_player = self.matchmaking_service.get_connected_player(user_id)
            if inviter_player:
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_error",
                    "message": "Zaten bekleyen bir davetin var"
                })
            return

        if self.matchmaking_service.get_invite_for_user(target_user_id):
            inviter_player = self.matchmaking_service.get_connected_player(user_id)
            if inviter_player:
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_error",
                    "message": "Arkadaşın başka bir davette"
                })
            return

        target_player = self.matchmaking_service.get_connected_player(target_user_id)
        target_notify = self.matchmaking_service.get_notification(target_user_id)
        if not target_player and not target_notify:
            inviter_player = self.matchmaking_service.get_connected_player(user_id)
            if inviter_player:
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_error",
                    "message": "Arkadaşın çevrimiçi değil"
                })
            return

        if self.matchmaking_service.is_player_busy(user_id) or self.matchmaking_service.is_player_busy(target_user_id):
            inviter_player = self.matchmaking_service.get_connected_player(user_id)
            if inviter_player:
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_error",
                    "message": "Şu anda maç başlatılamıyor"
                })
            return

        invite_id = str(uuid.uuid4())
        inviter_in_queue = self.matchmaking_service.is_in_queue(user_id)
        target_in_queue = self.matchmaking_service.is_in_queue(target_user_id)
        target_name = target_player.username if target_player else "Player"
        self.matchmaking_service.store_invite(
            invite_id,
            user_id,
            target_user_id,
            username,
            target_name,
            inviter_in_queue,
            target_in_queue
        )
        self.matchmaking_service.remove_from_queue_by_id(user_id)
        self.matchmaking_service.remove_from_queue_by_id(target_user_id)

        if target_player:
            await target_player.websocket.send_json({
                "type": "friend_invite",
                "invite_id": invite_id,
                "from_user_id": user_id,
                "from_username": username
            })

        if target_notify:
            await target_notify.send_json({
                "type": "friend_invite",
                "invite_id": invite_id,
                "from_user_id": user_id,
                "from_username": username
            })

        inviter_player = self.matchmaking_service.get_connected_player(user_id)
        if inviter_player:
            await inviter_player.websocket.send_json({
                "type": "friend_invite_sent",
                "invite_id": invite_id,
                "to_user_id": target_user_id
            })

        inviter_notify = self.matchmaking_service.get_notification(user_id)
        if inviter_notify:
            await inviter_notify.send_json({
                "type": "friend_invite_sent",
                "invite_id": invite_id,
                "to_user_id": target_user_id
            })

    async def _handle_friend_invite_response(self, user_id: str, data: Dict):
        invite_id = data.get("invite_id")
        action = (data.get("action") or "").strip().lower()
        invite = self.matchmaking_service.pop_invite(invite_id)
        if not invite:
            return

        if action == "cancel":
            if invite["inviter_id"] != user_id:
                return

            target_player = self.matchmaking_service.get_connected_player(invite["target_id"])
            if target_player:
                await target_player.websocket.send_json({
                    "type": "friend_invite_cancelled",
                    "invite_id": invite_id,
                    "message": "Davet iptal edildi"
                })

            target_notify = self.matchmaking_service.get_notification(invite["target_id"])
            if target_notify:
                await target_notify.send_json({
                    "type": "friend_invite_cancelled",
                    "invite_id": invite_id,
                    "message": "Davet iptal edildi"
                })

            inviter_player = self.matchmaking_service.get_connected_player(invite["inviter_id"])
            if inviter_player and invite.get("inviter_in_queue"):
                self.matchmaking_service.add_to_queue(inviter_player)
            if target_player and invite.get("target_in_queue"):
                self.matchmaking_service.add_to_queue(target_player)
            return

        if invite["target_id"] != user_id:
            return

        inviter_player = self.matchmaking_service.get_connected_player(invite["inviter_id"])
        target_player = self.matchmaking_service.get_connected_player(invite["target_id"])

        if action == "accept":
            if not inviter_player or not target_player:
                if inviter_player:
                    await inviter_player.websocket.send_json({
                        "type": "friend_invite_error",
                        "message": "Arkadaş çevrimdışı"
                    })
                return

            if self.matchmaking_service.is_player_busy(invite["inviter_id"]) or self.matchmaking_service.is_player_busy(invite["target_id"]):
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_error",
                    "message": "Şu anda maç başlatılamıyor"
                })
                return

            self.matchmaking_service.remove_from_queue_by_id(invite["inviter_id"])
            self.matchmaking_service.remove_from_queue_by_id(invite["target_id"])

            room = self.matchmaking_service.create_room_with_players(inviter_player, target_player)
            await self._handle_match_found(room)
        else:
            if inviter_player:
                await inviter_player.websocket.send_json({
                    "type": "friend_invite_declined",
                    "message": "Arkadaş daveti reddetti"
                })

            inviter_notify = self.matchmaking_service.get_notification(invite["inviter_id"])
            if inviter_notify:
                await inviter_notify.send_json({
                    "type": "friend_invite_declined",
                    "message": "Arkadaş daveti reddetti"
                })

            if inviter_player and invite.get("inviter_in_queue"):
                self.matchmaking_service.add_to_queue(inviter_player)
            if target_player and invite.get("target_in_queue"):
                self.matchmaking_service.add_to_queue(target_player)
    
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
        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            logger.warning(f"No room found for player {player_id} sending emoji")
            await websocket.send_json({
                "type": "emoji_error",
                "message": "Rakip oyundan ayrıldı"
            })
            return
        
        if room.game_ended:
            await websocket.send_json({
                "type": "emoji_error",
                "message": "Oyun sona erdi"
            })
            return
        
        emoji = data.get("emoji", "")
        if not emoji:
            return
        
        player = room.get_player(player_id)
        opponent = room.get_opponent(player)
        
        if not opponent:
            return
        
        try:
            await opponent.websocket.send_json({
                "type": "emoji_received",
                "emoji": emoji,
                "from": username,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error sending emoji to opponent: {e}")
    
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

                player1 = user_service.get_user_by_supabase_id(room.player1.id)
                player2 = user_service.get_user_by_supabase_id(room.player2.id)
                
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
        invite_id = self.matchmaking_service.get_invite_for_user(player_id)
        self.matchmaking_service.unregister_player(player_id)
        if invite_id:
            invite = self.matchmaking_service.pop_invite(invite_id)
            if invite and invite.get("inviter_id") == player_id:
                target_player = self.matchmaking_service.get_connected_player(invite["target_id"])
                if target_player:
                    await target_player.websocket.send_json({
                        "type": "friend_invite_cancelled",
                        "invite_id": invite_id,
                        "message": "Davet iptal edildi"
                    })
                target_notify = self.matchmaking_service.get_notification(invite["target_id"])
                if target_notify:
                    await target_notify.send_json({
                        "type": "friend_invite_cancelled",
                        "invite_id": invite_id,
                        "message": "Davet iptal edildi"
                    })

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
