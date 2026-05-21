import asyncio
import json
import os
import uuid
from typing import Dict, Literal, Optional

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)

_PLAYER_WORKER_TTL = 90  # seconds — covers ping_interval * 3

Channel = Literal["notify", "game"]


class WebSocketBridge:
    """
    Routes WebSocket messages to users regardless of which worker holds their connection.

    Two independent registries are maintained:
    - ``notify`` — ws/notify connections (push notifications, friend invites …)
    - ``game``   — ws/queue connections (in-game traffic)

    This prevents a user's notify socket and game socket from evicting each other,
    which was the root cause of the friend-invite "stuck on connecting" bug.

    - Local sends: direct in-process call to the WebSocket object.
    - Remote sends: serialized over Redis Pub/Sub to the owning worker.
    """

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self.worker_id = f"{os.getpid()}-{uuid.uuid4().hex[:8]}"
        self._notify_local: Dict[str, WebSocket] = {}
        self._game_local: Dict[str, WebSocket] = {}
        self._channel = f"ws:worker:{self.worker_id}"
        self._listener_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _registry(self, channel: Channel) -> Dict[str, WebSocket]:
        """Return the local dict for the given channel."""
        return self._notify_local if channel == "notify" else self._game_local

    @staticmethod
    def _redis_key(user_id: str, channel: Channel) -> str:
        return f"player:{user_id}:ws:worker:{channel}"

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self):
        self._listener_task = asyncio.create_task(self._listen())
        logger.info(f"WebSocketBridge started — worker {self.worker_id}")

    async def stop(self):
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        logger.info("WebSocketBridge stopped")

    # ------------------------------------------------------------------
    # Connection registry
    # ------------------------------------------------------------------

    async def register(self, user_id: str, websocket: WebSocket, channel: Channel = "game"):
        self._registry(channel)[user_id] = websocket
        await self.redis.set(
            self._redis_key(user_id, channel), self.worker_id, ex=_PLAYER_WORKER_TTL
        )

    async def unregister(
        self,
        user_id: str,
        websocket: Optional[WebSocket] = None,
        channel: Channel = "game",
    ):
        """
        Remove a user from the specified channel registry.

        If *websocket* is provided, the entry is only removed when it matches
        the currently-registered socket.  This prevents a stale cleanup (e.g.
        a closing notify socket) from evicting a newer connection (e.g. the
        game socket that registered immediately afterwards).
        """
        registry = self._registry(channel)
        if websocket is not None and registry.get(user_id) is not websocket:
            return
        registry.pop(user_id, None)
        await self.redis.delete(self._redis_key(user_id, channel))

    async def refresh_ttl(self, user_id: str, channel: Channel = "game"):
        """Call periodically (e.g. on each ping) to keep the Redis key alive."""
        await self.redis.expire(self._redis_key(user_id, channel), _PLAYER_WORKER_TTL)

    async def is_user_connected(self, user_id: str, channel: Channel = "game") -> bool:
        """True if any worker currently holds a connection for this user on the given channel."""
        if user_id in self._registry(channel):
            return True
        return bool(await self.redis.exists(self._redis_key(user_id, channel)))

    def get_local_websocket(self, user_id: str, channel: Channel = "game") -> Optional[WebSocket]:
        return self._registry(channel).get(user_id)

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    async def send_to_user(
        self, user_id: str, message: dict, channel: Channel = "game"
    ) -> bool:
        """
        Deliver a message to a user on the given channel — local fast-path or cross-worker Pub/Sub.
        Returns True if the message was dispatched (not necessarily received).
        """
        ws = self._registry(channel).get(user_id)
        if ws is not None:
            try:
                await ws.send_json(message)
                return True
            except Exception as e:
                logger.warning(f"Bridge: local send failed for {user_id} ({channel}): {e}")
                self._registry(channel).pop(user_id, None)
                return False

        target_worker = await self.redis.get(self._redis_key(user_id, channel))
        if not target_worker:
            logger.debug(f"Bridge: no worker registered for {user_id} ({channel})")
            return False

        await self.redis.publish(
            f"ws:worker:{target_worker}",
            json.dumps({"user_id": user_id, "message": message}),
        )
        return True

    # ------------------------------------------------------------------
    # Internal Pub/Sub listener
    # ------------------------------------------------------------------

    async def _listen(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(self._channel)
        logger.debug(f"Bridge subscribed to {self._channel}")
        try:
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                try:
                    payload = json.loads(raw["data"])
                    user_id = payload["user_id"]
                    # Cross-worker messages are always game-channel traffic
                    # (notify messages are typically same-worker or server-originated)
                    ws = self._game_local.get(user_id) or self._notify_local.get(user_id)
                    if ws:
                        await ws.send_json(payload["message"])
                    else:
                        logger.debug(f"Bridge: no local socket for routed message to {user_id}")
                except Exception as e:
                    logger.error(f"Bridge listener error: {e}")
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(self._channel)
            await pubsub.aclose()
