import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional

import redis.asyncio as aioredis

from app.models.domain import Player, GameRoom
from app.services.game_service import GameService
from app.core.logging import get_logger

logger = get_logger(__name__)

_QUEUE_KEY = "mm:queue"
_ROOM_TTL = 7200   # 2 hours
_INVITE_TTL = 300  # 5 minutes

# Atomic Lua: pop front player, find a different player, return both or push back.
_LUA_MATCH = """
local key = KEYS[1]
local p1 = redis.call('LPOP', key)
if not p1 then return nil end
local p1id = cjson.decode(p1)['id']
local len = redis.call('LLEN', key)
for i = 0, len - 1 do
  local p2 = redis.call('LINDEX', key, i)
  if cjson.decode(p2)['id'] ~= p1id then
    redis.call('LREM', key, 1, p2)
    return {p1, p2}
  end
end
redis.call('LPUSH', key, p1)
return nil
"""


class MatchmakingService:

    def __init__(self, game_service: GameService, redis: aioredis.Redis):
        self.game_service = game_service
        self.redis = redis
        self.worker_id: str = ""  # set by main.py after init

        # In-memory: rooms owned by this worker
        self.active_rooms: Dict[str, GameRoom] = {}

    # ------------------------------------------------------------------
    # Queue
    # ------------------------------------------------------------------

    async def add_to_queue(self, player_id: str, username: str) -> int:
        await self.remove_from_queue_by_id(player_id)
        entry = json.dumps({"id": player_id, "username": username})
        await self.redis.rpush(_QUEUE_KEY, entry)
        length = await self.redis.llen(_QUEUE_KEY)
        logger.info(f"Player {username} ({player_id}) joined queue — depth {length}")
        return length

    async def remove_from_queue_by_id(self, player_id: str):
        items = await self.redis.lrange(_QUEUE_KEY, 0, -1)
        for item in items:
            if json.loads(item).get("id") == player_id:
                await self.redis.lrem(_QUEUE_KEY, 1, item)
                logger.info(f"Removed {player_id} from queue")
                return

    async def is_in_queue(self, player_id: str) -> bool:
        items = await self.redis.lrange(_QUEUE_KEY, 0, -1)
        return any(json.loads(i).get("id") == player_id for i in items)

    async def try_match_players(self) -> Optional[GameRoom]:
        result = await self.redis.eval(_LUA_MATCH, 1, _QUEUE_KEY)
        if not result:
            return None
        p1 = json.loads(result[0])
        p2 = json.loads(result[1])
        room = await self._create_and_register_room(p1["id"], p1["username"], p2["id"], p2["username"])
        logger.info(f"Matched {p1['username']} vs {p2['username']} in room {room.id}")
        return room

    # ------------------------------------------------------------------
    # Rooms
    # ------------------------------------------------------------------

    async def _create_and_register_room(
        self, p1_id: str, p1_name: str, p2_id: str, p2_name: str
    ) -> GameRoom:
        player1 = Player(p1_id, p1_name)
        player2 = Player(p2_id, p2_name)
        room_id = str(uuid.uuid4())
        room = self.game_service.create_game_room(room_id, player1, player2)
        self.active_rooms[room_id] = room
        await self._register_room_in_redis(room)
        return room

    async def create_room(
        self, p1_id: str, p1_name: str, p2_id: str, p2_name: str
    ) -> GameRoom:
        room = await self._create_and_register_room(p1_id, p1_name, p2_id, p2_name)
        logger.info(f"Created friend room: {p1_name} vs {p2_name} in room {room.id}")
        return room

    async def _register_room_in_redis(self, room: GameRoom):
        pipe = self.redis.pipeline()
        pipe.set(f"mm:player:{room.player1.id}:room", room.id, ex=_ROOM_TTL)
        pipe.set(f"mm:player:{room.player2.id}:room", room.id, ex=_ROOM_TTL)
        pipe.set(f"mm:room:{room.id}:worker", self.worker_id, ex=_ROOM_TTL)
        await pipe.execute()
        await self._snapshot_room(room)

    async def _snapshot_room(self, room: GameRoom):
        """Write reconnect state to Redis — any worker can serve a reconnect."""
        await self.redis.hset(f"mm:room:{room.id}", mapping=room.to_snapshot())
        await self.redis.expire(f"mm:room:{room.id}", _ROOM_TTL)

    def get_room(self, room_id: str) -> Optional[GameRoom]:
        return self.active_rooms.get(room_id)

    def get_room_by_player(self, player_id: str) -> Optional[GameRoom]:
        """Local in-memory lookup only."""
        for room in self.active_rooms.values():
            if room.player1.id == player_id or room.player2.id == player_id:
                return room
        return None

    async def get_room_id_from_redis(self, player_id: str) -> Optional[str]:
        return await self.redis.get(f"mm:player:{player_id}:room")

    async def get_room_snapshot(self, room_id: str) -> Optional[Dict]:
        data = await self.redis.hgetall(f"mm:room:{room_id}")
        return data if data else None

    async def is_player_busy(self, player_id: str) -> bool:
        return bool(await self.redis.exists(f"mm:player:{player_id}:room"))

    async def cleanup_room(self, room_id: str):
        room = self.active_rooms.pop(room_id, None)
        if room:
            pipe = self.redis.pipeline()
            pipe.delete(f"mm:player:{room.player1.id}:room")
            pipe.delete(f"mm:player:{room.player2.id}:room")
            pipe.delete(f"mm:room:{room_id}:worker")
            pipe.delete(f"mm:room:{room_id}")
            await pipe.execute()
            logger.info(f"Cleaned up room {room_id}")

    # ------------------------------------------------------------------
    # Friend invites (Redis-backed)
    # ------------------------------------------------------------------

    async def get_invite_for_user(self, user_id: str) -> Optional[str]:
        """Returns the invite_id if user has an active invite, else None."""
        return await self.redis.get(f"mm:user_invite:{user_id}")

    async def get_invite(self, invite_id: str) -> Optional[Dict]:
        """Returns the full invite dict or None if not found."""
        data = await self.redis.hgetall(f"mm:invite:{invite_id}")
        if not data:
            return None
        data["inviter_in_queue"] = data.get("inviter_in_queue") == "1"
        data["target_in_queue"] = data.get("target_in_queue") == "1"
        return data

    async def store_invite(
        self,
        invite_id: str,
        inviter_id: str,
        target_id: str,
        inviter_name: str,
        target_name: str,
        inviter_in_queue: bool,
        target_in_queue: bool,
    ) -> None:
        mapping = {
            "invite_id": invite_id,
            "inviter_id": inviter_id,
            "target_id": target_id,
            "inviter_name": inviter_name,
            "target_name": target_name,
            "inviter_in_queue": "1" if inviter_in_queue else "0",
            "target_in_queue": "1" if target_in_queue else "0",
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
        }
        pipe = self.redis.pipeline()
        pipe.hset(f"mm:invite:{invite_id}", mapping=mapping)
        pipe.expire(f"mm:invite:{invite_id}", _INVITE_TTL)
        pipe.set(f"mm:user_invite:{inviter_id}", invite_id, ex=_INVITE_TTL)
        pipe.set(f"mm:user_invite:{target_id}", invite_id, ex=_INVITE_TTL)
        await pipe.execute()

    async def pop_invite(self, invite_id: str) -> Optional[Dict]:
        """Returns the invite and removes it atomically."""
        invite = await self.get_invite(invite_id)
        if not invite:
            return None
        pipe = self.redis.pipeline()
        pipe.delete(f"mm:invite:{invite_id}")
        pipe.delete(f"mm:user_invite:{invite['inviter_id']}")
        pipe.delete(f"mm:user_invite:{invite['target_id']}")
        await pipe.execute()
        return invite

    async def cancel_invite_by_inviter(self, inviter_id: str) -> Optional[Dict]:
        invite_id = await self.get_invite_for_user(inviter_id)
        if not invite_id:
            return None
        invite = await self.get_invite(invite_id)
        if not invite or invite.get("inviter_id") != inviter_id:
            return None
        return await self.pop_invite(invite_id)

    async def create_invite(
        self, inviter_id: str, inviter_name: str, target_id: str, target_name: str
    ) -> Dict:
        if await self.get_invite_for_user(inviter_id) or await self.get_invite_for_user(target_id):
            raise ValueError("Invite already exists")
        invite_id = str(uuid.uuid4())
        await self.store_invite(invite_id, inviter_id, target_id, inviter_name, target_name, False, False)
        return await self.get_invite(invite_id)

    async def get_active_invite_for_user(self, user_id: str) -> Optional[Dict]:
        invite_id = await self.get_invite_for_user(user_id)
        if not invite_id:
            return None
        invite = await self.get_invite(invite_id)
        if not invite or invite.get("status") != "pending":
            return None
        if invite.get("target_id") != user_id:
            return None
        return invite

    async def set_invite_status(self, invite_id: str, status: str) -> Optional[Dict]:
        invite = await self.get_invite(invite_id)
        if not invite:
            return None
        if status in ("declined", "cancelled"):
            return await self.pop_invite(invite_id)
        await self.redis.hset(f"mm:invite:{invite_id}", "status", status)
        return {**invite, "status": status}

    async def mark_invite_join(self, invite_id: str, user_id: str, username: str) -> Optional[GameRoom]:
        invite = await self.get_invite(invite_id)
        if not invite or invite.get("status") != "accepted":
            return None
        await self.redis.hset(f"mm:invite:{invite_id}", f"joiner_{user_id}", username)
        updated = await self.get_invite(invite_id)
        has_inviter = bool(updated.get(f"joiner_{updated['inviter_id']}"))
        has_target = bool(updated.get(f"joiner_{updated['target_id']}"))
        if has_inviter and has_target:
            room = await self.create_room(
                invite["inviter_id"], invite["inviter_name"],
                invite["target_id"], invite["target_name"],
            )
            await self.pop_invite(invite_id)
            return room
        return None

    # ------------------------------------------------------------------
    # Stats
    # ------------------------------------------------------------------

    def get_stats(self) -> Dict:
        return {
            "active_rooms": len(self.active_rooms),
            "waiting_players": -1,  # async — read from Redis if needed
        }

    async def get_queue_depth(self) -> int:
        return await self.redis.llen(_QUEUE_KEY)
