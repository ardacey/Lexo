from fastapi import WebSocket, WebSocketDisconnect
import asyncio

from app.core.logging import get_logger
from app.websocket.auth import authenticate_websocket, WebSocketAuthError
from app.services.matchmaking_service import MatchmakingService
from app.services.ws_bridge import WebSocketBridge

logger = get_logger(__name__)


class NotificationWebSocketHandler:
    def __init__(self, matchmaking_service: MatchmakingService, bridge: WebSocketBridge):
        self.matchmaking_service = matchmaking_service
        self.bridge = bridge

    async def handle_connection(self, websocket: WebSocket):
        await websocket.accept()
        user_id = None

        try:
            try:
                user_data = await authenticate_websocket(websocket)
                user_id = user_data["user_id"]
            except WebSocketAuthError:
                await websocket.close(code=1008)
                return

            await self.bridge.register(user_id, websocket)

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
                        await self.bridge.refresh_ttl(user_id)
                        await websocket.send_json({"type": "pong"})
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            logger.info(f"Notification socket closed for {user_id}")
        except Exception as exc:
            logger.error(f"Notification websocket error: {exc}")
        finally:
            if user_id:
                await self.bridge.unregister(user_id)

    async def _handle_decline(self, user_id: str, invite_id: str):
        invite = self.matchmaking_service.pop_invite(invite_id)
        if not invite:
            return
        if invite["target_id"] != user_id:
            return
        await self.bridge.send_to_user(invite["inviter_id"], {
            "type": "friend_invite_declined",
            "message": "Arkadaş daveti reddetti"
        })
