import asyncio
import json
import os
import uuid
from typing import Dict, Optional

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.core.logging import get_logger

logger = get_logger(__name__)

_PLAYER_WORKER_TTL = 90  # seconds — covers ping_interval * 3


class WebSocketBridge:
    """
    Routes WebSocket messages to users regardless of which worker holds their connection.
    - Local sends: direct in-process call to the WebSocket object.
    - Remote sends: serialized over Redis Pub/Sub to the owning worker.
    """

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self.worker_id = f"{os.getpid()}-{uuid.uuid4().hex[:8]}"
        self._local: Dict[str, WebSocket] = {}
        self._channel = f"ws:worker:{self.worker_id}"
        self._listener_task: Optional[asyncio.Task] = None

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

    async def register(self, user_id: str, websocket: WebSocket):
        self._local[user_id] = websocket
        await self.redis.set(
            f"player:{user_id}:ws:worker", self.worker_id, ex=_PLAYER_WORKER_TTL
        )

    async def unregister(self, user_id: str):
        self._local.pop(user_id, None)
        await self.redis.delete(f"player:{user_id}:ws:worker")

    async def refresh_ttl(self, user_id: str):
        """Call periodically (e.g. on each ping) to keep the key alive."""
        await self.redis.expire(f"player:{user_id}:ws:worker", _PLAYER_WORKER_TTL)

    async def is_user_connected(self, user_id: str) -> bool:
        """True if any worker currently holds a connection for this user."""
        if user_id in self._local:
            return True
        return bool(await self.redis.exists(f"player:{user_id}:ws:worker"))

    def get_local_websocket(self, user_id: str) -> Optional[WebSocket]:
        return self._local.get(user_id)

    # ------------------------------------------------------------------
    # Messaging
    # ------------------------------------------------------------------

    async def send_to_user(self, user_id: str, message: dict) -> bool:
        """
        Deliver a message to a user — local fast-path or cross-worker Pub/Sub.
        Returns True if the message was dispatched (not necessarily received).
        """
        ws = self._local.get(user_id)
        if ws is not None:
            try:
                await ws.send_json(message)
                return True
            except Exception as e:
                logger.warning(f"Bridge: local send failed for {user_id}: {e}")
                self._local.pop(user_id, None)
                return False

        target_worker = await self.redis.get(f"player:{user_id}:ws:worker")
        if not target_worker:
            logger.debug(f"Bridge: no worker registered for {user_id}")
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
                    ws = self._local.get(user_id)
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
