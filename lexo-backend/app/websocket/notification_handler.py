from fastapi import WebSocket, WebSocketDisconnect
import asyncio

from app.core.logging import get_logger
from app.websocket.auth import authenticate_websocket, WebSocketAuthError
from app.services.matchmaking_service import MatchmakingService

logger = get_logger(__name__)


class NotificationWebSocketHandler:
    def __init__(self, matchmaking_service: MatchmakingService):
        self.matchmaking_service = matchmaking_service

    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()
        user_id = None

        try:
            try:
                user_data = await authenticate_websocket(websocket)
                user_id = user_data["user_id"]
            except WebSocketAuthError as exc:
                await websocket.close(code=1008)
                return

            self.matchmaking_service.register_notification(user_id, websocket)

            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                    message_type = data.get("type")
                    if message_type == "friend_invite_response":
                        invite_id = data.get("invite_id")
                        action = (data.get("action") or "").strip().lower()
                        if invite_id and action == "decline":
                            await self._handle_decline(user_id, invite_id)
                    elif message_type == "ping":
                        await websocket.send_json({"type": "pong"})
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            logger.info(f"Notification socket closed for {user_id}")
        except Exception as exc:
            logger.error(f"Notification websocket error: {exc}")
        finally:
            if user_id:
                self.matchmaking_service.unregister_notification(user_id)

    async def _handle_decline(self, user_id: str, invite_id: str):
        invite = self.matchmaking_service.pop_invite(invite_id)
        if not invite:
            return
        if invite["target_id"] != user_id:
            return
        inviter_player = self.matchmaking_service.get_connected_player(invite["inviter_id"])
        if inviter_player:
            await inviter_player.websocket.send_json({
                "type": "friend_invite_declined",
                "message": "Arkadaş daveti reddetti"
            })
        inviter_socket = self.matchmaking_service.get_notification(invite["inviter_id"])
        if inviter_socket:
            await inviter_socket.send_json({
                "type": "friend_invite_declined",
                "message": "Arkadaş daveti reddetti"
            })
