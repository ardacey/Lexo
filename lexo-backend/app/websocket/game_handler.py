import asyncio
import time
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.database.session import AsyncSessionLocal
from app.models.domain import GameRoom, Player
from app.services.game_history_service import GameHistoryService
from app.services.matchmaking_service import MatchmakingService
from app.services.stats_service import StatsService
from app.services.user_service import UserService
from app.services.word_service import WordService
from app.services.ws_bridge import WebSocketBridge
from app.core.logging import get_logger
from app.websocket.auth import (
    RateLimiter,
    WebSocketAuthError,
    authenticate_websocket,
    send_error_response,
    validate_message,
)

logger = get_logger(__name__)


class GameWebSocketHandler:

    def __init__(
        self,
        matchmaking_service: MatchmakingService,
        word_service: WordService,
        bridge: WebSocketBridge,
    ):
        self.matchmaking_service = matchmaking_service
        self.word_service = word_service
        self.bridge = bridge
        self.rate_limiters: Dict[str, RateLimiter] = {}

    # ------------------------------------------------------------------
    # Main connection loop
    # ------------------------------------------------------------------

    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()
        user_id: Optional[str] = None

        try:
            try:
                user_data = await authenticate_websocket(websocket)
                user_id = user_data["user_id"]
                username = user_data.get("username", "Player")
                initial_data = user_data.get("initial_data") or {}
            except WebSocketAuthError as e:
                logger.warning(f"WS auth failed: {e}")
                await send_error_response(websocket, str(e), close=True)
                return

            await self.bridge.register(user_id, websocket)
            if user_id not in self.rate_limiters:
                self.rate_limiters[user_id] = RateLimiter()

            # --- Reconnect check ---
            existing_room = self.matchmaking_service.get_room_by_player(user_id)
            if not existing_room:
                # Try Redis for cross-worker reconnect
                room_id = await self.matchmaking_service.get_room_id_from_redis(user_id)
                if room_id:
                    snapshot = await self.matchmaking_service.get_room_snapshot(room_id)
                    if snapshot and snapshot.get("game_started") == "1" and snapshot.get("game_ended") == "0":
                        # Serve reconnect state from snapshot (game lives on another worker)
                        await self._serve_reconnect_from_snapshot(websocket, user_id, snapshot)
                        # Drop into message loop — game messages will be handled here
                        # but the owning worker has the authoritative room state
                        await self._message_loop(websocket, user_id, username)
                        return

            if existing_room and existing_room.game_started and not existing_room.game_ended:
                time_remaining = existing_room.get_time_remaining()
                if time_remaining and time_remaining > 0:
                    existing_player = existing_room.get_player(user_id)
                    if existing_player:
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
                            "server_start_time": (
                                int(existing_room.start_time.timestamp() * 1000)
                                if existing_room.start_time else None
                            ),
                            "duration": existing_room.duration,
                            "server_time": int(time.time() * 1000),
                            "my_words": existing_player.words,
                            "used_words": list(existing_room.used_words),
                        })

                        await self.bridge.send_to_user(opponent.id, {
                            "type": "opponent_reconnected",
                            "message": "Rakip oyuna geri döndü",
                        })
                        logger.info(f"Player {user_id} reconnected to {existing_room.id}")
                else:
                    existing_room.end_game()
                    await self.matchmaking_service.cleanup_room(existing_room.id)
                    await websocket.send_json({"type": "game_expired", "message": "Oyun süresi doldu"})
                    await websocket.close()
                    return
            else:
                mode = initial_data.get("mode")
                invite_id = initial_data.get("invite_id")

                await websocket.send_json({
                    "type": "queue_joined",
                    "message": "Arkadaş maçına bağlanılıyor..." if mode == "friend" else "Oyun aranıyor...",
                    "player_id": user_id,
                    "queue_position": None,
                })

                if mode == "friend" and invite_id:
                    room = await self.matchmaking_service.mark_invite_join(invite_id, user_id, username)
                    if room:
                        await self._handle_match_found(room)
                else:
                    queue_pos = await self.matchmaking_service.add_to_queue(user_id, username)
                    await websocket.send_json({
                        "type": "queue_joined",
                        "message": "Oyun aranıyor...",
                        "player_id": user_id,
                        "queue_position": queue_pos,
                    })
                    room = await self.matchmaking_service.try_match_players()
                    if room:
                        await self._handle_match_found(room)

            await self._message_loop(websocket, user_id, username)

        except WebSocketDisconnect:
            logger.info(f"Player {user_id} disconnected normally")
        except Exception as e:
            logger.error(f"WebSocket error for {user_id}: {e}")
        finally:
            if user_id:
                await self._handle_disconnect(user_id)

    async def _message_loop(self, websocket: WebSocket, user_id: str, username: str):
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)

                if not validate_message(data):
                    await send_error_response(websocket, "Invalid message format")
                    continue

                rate_limiter = self.rate_limiters.get(user_id)
                if rate_limiter and not rate_limiter.is_allowed(user_id):
                    await send_error_response(websocket, "Too many messages, please slow down")
                    continue

                msg_type = data.get("type")
                if msg_type == "submit_word":
                    await self._handle_word_submission(websocket, user_id, data, username)
                elif msg_type == "send_emoji":
                    await self._handle_emoji_message(websocket, user_id, data, username)
                elif msg_type == "friend_invite":
                    await self._handle_friend_invite(websocket, user_id, username, data)
                elif msg_type == "friend_invite_response":
                    await self._handle_friend_invite_response(websocket, user_id, data)
                elif msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "client_time": data.get("client_time"),
                        "server_time": int(time.time() * 1000),
                    })
                    await self.bridge.refresh_ttl(user_id)

            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    logger.warning(f"Client {user_id} not responding to ping — closing")
                    break
            except WebSocketDisconnect:
                logger.info(f"Client {user_id} disconnected normally")
                break
            except Exception as e:
                logger.error(f"Error processing message from {user_id}: {e}")
                break

    async def _serve_reconnect_from_snapshot(
        self, websocket: WebSocket, user_id: str, snapshot: Dict
    ):
        """Send reconnect state built from a Redis snapshot (cross-worker reconnect)."""
        is_p1 = snapshot.get("player1_id") == user_id
        opp_username = snapshot["player2_username"] if is_p1 else snapshot["player1_username"]
        opp_id = snapshot["player2_id"] if is_p1 else snapshot["player1_id"]
        my_words_raw = snapshot["player1_words"] if is_p1 else snapshot["player2_words"]
        my_words = [w for w in my_words_raw.split(",") if w]
        start_time_raw = snapshot.get("start_time", "")
        server_start_ms = None
        if start_time_raw:
            try:
                server_start_ms = int(
                    datetime.fromisoformat(start_time_raw).timestamp() * 1000
                )
            except ValueError:
                pass
        duration = int(snapshot.get("duration", 60))
        elapsed = 0
        if server_start_ms:
            elapsed = (int(time.time() * 1000) - server_start_ms) // 1000
        time_remaining = max(0, duration - elapsed)

        await websocket.send_json({
            "type": "reconnected",
            "room_id": snapshot["id"],
            "opponent": opp_username,
            "opponent_user_id": opp_id,
            "letter_pool": [l for l in snapshot.get("letter_pool", "").split(",") if l],
            "scores": [
                {"username": snapshot["player1_username"], "score": int(snapshot["player1_score"])},
                {"username": snapshot["player2_username"], "score": int(snapshot["player2_score"])},
            ],
            "time_remaining": time_remaining,
            "server_start_time": server_start_ms,
            "duration": duration,
            "server_time": int(time.time() * 1000),
            "my_words": my_words,
            "used_words": [w for w in snapshot.get("used_words", "").split(",") if w],
        })
        await self.bridge.send_to_user(opp_id, {
            "type": "opponent_reconnected",
            "message": "Rakip oyuna geri döndü",
        })

    # ------------------------------------------------------------------
    # Match flow
    # ------------------------------------------------------------------

    async def _handle_match_found(self, room: GameRoom):
        await self.bridge.send_to_user(room.player1.id, {
            "type": "match_found",
            "room_id": room.id,
            "opponent": room.player2.username,
            "opponent_user_id": room.player2.id,
        })
        await self.bridge.send_to_user(room.player2.id, {
            "type": "match_found",
            "room_id": room.id,
            "opponent": room.player1.username,
            "opponent_user_id": room.player1.id,
        })
        logger.info(f"Match found — room {room.id}")
        await self._start_game_countdown(room)

    async def _start_game_countdown(self, room: GameRoom):
        await asyncio.sleep(1)
        room.start_game()
        await self.matchmaking_service._snapshot_room(room)

        start_message = {
            "type": "game_start",
            "letter_pool": room.letter_pool,
            "duration": room.duration,
            "scores": room.get_scores(),
            "server_start_time": (
                int(room.start_time.timestamp() * 1000) if room.start_time else None
            ),
            "server_time": int(time.time() * 1000),
        }
        await self.bridge.send_to_user(room.player1.id, start_message)
        await self.bridge.send_to_user(room.player2.id, start_message)
        logger.info(f"Game started in room {room.id}")
        asyncio.create_task(self._end_game_after_duration(room))

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
                "game_saved_by_server": True,
            }
            await self.bridge.send_to_user(room.player1.id, end_message)
            await self.bridge.send_to_user(room.player2.id, end_message)
            logger.info(f"Game ended in room {room.id}, winner: {winner}")
            await self._save_game_to_database(room, winner)

    # ------------------------------------------------------------------
    # Game messages
    # ------------------------------------------------------------------

    async def _handle_word_submission(
        self, websocket: WebSocket, player_id: str, data: Dict, username: str
    ):
        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            return
        word = data.get("word", "").strip()
        player = room.get_player(player_id)
        if not player:
            return

        validation = self.matchmaking_service.game_service.validate_word_submission(room, word)
        if not validation["valid"]:
            await websocket.send_json({"type": "word_invalid", "message": validation["message"]})
            return

        result = self.matchmaking_service.game_service.process_word_submission(room, player, word)
        await websocket.send_json({
            "type": "word_valid",
            "word": result["word"],
            "score": result["score"],
            "total_score": result["total_score"],
            "letter_pool": result["letter_pool"],
            "scores": result["scores"],
        })

        opponent = room.get_opponent(player)
        await self.bridge.send_to_user(opponent.id, {
            "type": "opponent_word",
            "player": username,
            "word": result["word"],
            "score": result["score"],
            "letter_pool": result["letter_pool"],
            "scores": result["scores"],
        })

    async def _handle_emoji_message(
        self, websocket: WebSocket, player_id: str, data: Dict, username: str
    ):
        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            await websocket.send_json({"type": "emoji_error", "message": "Rakip oyundan ayrıldı"})
            return
        if room.game_ended:
            await websocket.send_json({"type": "emoji_error", "message": "Oyun sona erdi"})
            return
        emoji = data.get("emoji", "")
        if not emoji:
            return
        player = room.get_player(player_id)
        opponent = room.get_opponent(player)
        await self.bridge.send_to_user(opponent.id, {
            "type": "emoji_received",
            "emoji": emoji,
            "from": username,
            "timestamp": datetime.now().isoformat(),
        })

    # ------------------------------------------------------------------
    # Friend invites
    # ------------------------------------------------------------------

    async def _handle_friend_invite(
        self, websocket: WebSocket, user_id: str, username: str, data: Dict
    ):
        target_id = data.get("target_user_id")
        if not target_id or target_id == user_id:
            await websocket.send_json({"type": "friend_invite_error", "message": "Geçersiz arkadaş daveti"})
            return

        if self.matchmaking_service.get_invite_for_user(user_id):
            await websocket.send_json({"type": "friend_invite_error", "message": "Zaten bekleyen bir davetin var"})
            return

        if self.matchmaking_service.get_invite_for_user(target_id):
            await websocket.send_json({"type": "friend_invite_error", "message": "Arkadaşın başka bir davette"})
            return

        if not await self.bridge.is_user_connected(target_id):
            await websocket.send_json({"type": "friend_invite_error", "message": "Arkadaşın çevrimiçi değil"})
            return

        if await self.matchmaking_service.is_player_busy(user_id) or await self.matchmaking_service.is_player_busy(target_id):
            await websocket.send_json({"type": "friend_invite_error", "message": "Şu anda maç başlatılamıyor"})
            return

        invite_id = str(uuid.uuid4())
        inviter_in_queue = await self.matchmaking_service.is_in_queue(user_id)
        target_in_queue = await self.matchmaking_service.is_in_queue(target_id)
        target_name = data.get("target_username", "Player")

        self.matchmaking_service.store_invite(
            invite_id, user_id, target_id, username, target_name,
            inviter_in_queue, target_in_queue,
        )
        await self.matchmaking_service.remove_from_queue_by_id(user_id)
        await self.matchmaking_service.remove_from_queue_by_id(target_id)

        await self.bridge.send_to_user(target_id, {
            "type": "friend_invite",
            "invite_id": invite_id,
            "from_user_id": user_id,
            "from_username": username,
        })
        await websocket.send_json({
            "type": "friend_invite_sent",
            "invite_id": invite_id,
            "to_user_id": target_id,
        })

    async def _handle_friend_invite_response(
        self, websocket: WebSocket, user_id: str, data: Dict
    ):
        invite_id = data.get("invite_id")
        action = (data.get("action") or "").strip().lower()
        invite = self.matchmaking_service.pop_invite(invite_id)
        if not invite:
            return

        if action == "cancel":
            if invite["inviter_id"] != user_id:
                return
            await self.bridge.send_to_user(invite["target_id"], {
                "type": "friend_invite_cancelled",
                "invite_id": invite_id,
                "message": "Davet iptal edildi",
            })
            if invite.get("inviter_in_queue"):
                await self.matchmaking_service.add_to_queue(invite["inviter_id"], invite["inviter_name"])
            if invite.get("target_in_queue"):
                await self.matchmaking_service.add_to_queue(invite["target_id"], invite["target_name"])
            return

        if invite["target_id"] != user_id:
            return

        if action == "accept":
            if not await self.bridge.is_user_connected(invite["inviter_id"]):
                await websocket.send_json({"type": "friend_invite_error", "message": "Arkadaş çevrimdışı"})
                return
            if await self.matchmaking_service.is_player_busy(invite["inviter_id"]) or \
               await self.matchmaking_service.is_player_busy(invite["target_id"]):
                await self.bridge.send_to_user(invite["inviter_id"], {
                    "type": "friend_invite_error", "message": "Şu anda maç başlatılamıyor"
                })
                return

            await self.matchmaking_service.remove_from_queue_by_id(invite["inviter_id"])
            await self.matchmaking_service.remove_from_queue_by_id(invite["target_id"])
            invite["status"] = "accepted"
            self.matchmaking_service.friend_invites[invite_id] = invite
            self.matchmaking_service.invites_by_user[invite["inviter_id"]] = invite_id
            self.matchmaking_service.invites_by_user[invite["target_id"]] = invite_id

            await self.bridge.send_to_user(invite["inviter_id"], {
                "type": "friend_invite_accepted",
                "invite_id": invite_id,
            })

            room = await self.matchmaking_service.mark_invite_join(invite_id, user_id, invite["target_name"])
            if room:
                await self._handle_match_found(room)
        else:
            await self.bridge.send_to_user(invite["inviter_id"], {
                "type": "friend_invite_declined",
                "message": "Arkadaş daveti reddetti",
            })
            if invite.get("inviter_in_queue"):
                await self.matchmaking_service.add_to_queue(invite["inviter_id"], invite["inviter_name"])
            if invite.get("target_in_queue"):
                await self.matchmaking_service.add_to_queue(invite["target_id"], invite["target_name"])

    # ------------------------------------------------------------------
    # Disconnect
    # ------------------------------------------------------------------

    async def _handle_disconnect(self, player_id: str):
        self.rate_limiters.pop(player_id, None)
        await self.bridge.unregister(player_id)

        invite_id = self.matchmaking_service.get_invite_for_user(player_id)
        if invite_id:
            invite = self.matchmaking_service.pop_invite(invite_id)
            if invite and invite.get("inviter_id") == player_id:
                await self.bridge.send_to_user(invite["target_id"], {
                    "type": "friend_invite_cancelled",
                    "invite_id": invite_id,
                    "message": "Davet iptal edildi",
                })

        await self.matchmaking_service.remove_from_queue_by_id(player_id)

        room = self.matchmaking_service.get_room_by_player(player_id)
        if not room:
            return

        if not room.game_ended and room.game_started:
            disconnected = room.get_player(player_id)
            if disconnected:
                disconnected.connected = False
                disconnected.last_disconnect_time = datetime.now()

            opponent = room.get_opponent(disconnected) if disconnected else None
            if opponent:
                await self.bridge.send_to_user(opponent.id, {
                    "type": "opponent_disconnected_temp",
                    "message": "Rakip bağlantısı kesildi, tekrar bağlanması bekleniyor...",
                })
            asyncio.create_task(self._handle_grace_period_timeout(room, player_id))
        elif not room.game_started:
            await self.matchmaking_service.cleanup_room(room.id)
        else:
            await self.matchmaking_service.cleanup_room(room.id)

    async def _handle_grace_period_timeout(self, room: GameRoom, player_id: str):
        grace = room.reconnect_grace_period
        logger.info(f"Grace period {grace}s started for {player_id} in room {room.id}")
        await asyncio.sleep(grace)

        disconnected = room.get_player(player_id)
        if disconnected and not disconnected.connected and not room.game_ended:
            room.end_game()
            opponent = room.get_opponent(disconnected)
            winner = opponent.username if opponent else None

            if opponent:
                await self.bridge.send_to_user(opponent.id, {
                    "type": "opponent_disconnected",
                    "message": "Rakip oyundan ayrıldı. Siz kazandınız!",
                })

            await self._save_game_to_database(room, winner)
            await self.matchmaking_service.cleanup_room(room.id)
        elif room.game_ended:
            await self.matchmaking_service.cleanup_room(room.id)

    # ------------------------------------------------------------------
    # Database persistence
    # ------------------------------------------------------------------

    async def _save_game_to_database(self, room: GameRoom, winner_name: Optional[str]):
        if room.game_saved:
            return
        try:
            room.game_saved = True
            async with AsyncSessionLocal() as db:
                user_service = UserService(db)
                stats_service = StatsService(db)
                game_history_service = GameHistoryService(db)

                player1 = await user_service.get_user_by_supabase_id(room.player1.id)
                player2 = await user_service.get_user_by_supabase_id(room.player2.id)
                if not player1 or not player2:
                    logger.error(f"Cannot save game {room.id}: player not found")
                    return

                winner_id = None
                if winner_name == room.player1.username:
                    winner_id = player1.id
                elif winner_name == room.player2.username:
                    winner_id = player2.id

                await game_history_service.create_game_history(
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
                    ended_at=datetime.now(),
                )

                await stats_service.update_stats_after_game(
                    user_id=player1.id,
                    score=room.player1.score,
                    words=room.player1.words,
                    won=winner_id == player1.id if winner_id else False,
                    tied=winner_id is None,
                    game_duration=room.duration,
                )
                await stats_service.update_stats_after_game(
                    user_id=player2.id,
                    score=room.player2.score,
                    words=room.player2.words,
                    won=winner_id == player2.id if winner_id else False,
                    tied=winner_id is None,
                    game_duration=room.duration,
                )
                logger.info(f"Saved game {room.id} to database")
        except Exception as e:
            logger.error(f"Error saving game {room.id}: {e}")
