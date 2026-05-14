from typing import List
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DatabaseError, ValidationError
from app.models.database import User
from app.repositories.friend_repository import FriendRepository
from app.repositories.user_repository import UserRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class FriendService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.friend_repo = FriendRepository(db)
        self.user_repo = UserRepository(db)

    async def _get_user_by_supabase_id(self, supabase_user_id: str) -> User:
        user = await self.user_repo.get_by_supabase_user_id(supabase_user_id)
        if not user:
            raise ValidationError("User not found")
        return user

    def _build_turkish_pattern(self, query: str) -> str:
        replacements = {
            "i": "[iİ]",
            "I": "[Iı]",
            "ı": "[ıI]",
            "İ": "[İi]",
        }
        parts = []
        for char in query:
            if char in replacements:
                parts.append(replacements[char])
            else:
                parts.append(re.escape(char))
        return f".*{''.join(parts)}.*"

    async def search_users(self, current_user_id: str, query: str, limit: int = 10) -> List[User]:
        from sqlalchemy import or_
        user = await self._get_user_by_supabase_id(current_user_id)
        if not query:
            return []
        pattern = self._build_turkish_pattern(query)
        stmt = (
            select(User)
            .where(
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.username.op("~")(pattern),
                )
            )
            .where(User.id != user.id)
            .order_by(User.username.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_friends(self, current_user_id: str) -> List[User]:
        user = await self._get_user_by_supabase_id(current_user_id)
        return await self.friend_repo.list_friends(user.id)

    async def send_request(self, current_user_id: str, target_user_id: str) -> None:
        try:
            requester = await self._get_user_by_supabase_id(current_user_id)
            target = await self._get_user_by_supabase_id(target_user_id)

            if requester.id == target.id:
                raise ValidationError("Cannot send friend request to yourself")

            if await self.friend_repo.get_friend(requester.id, target.id):
                raise ValidationError("You are already friends")

            existing = await self.friend_repo.get_request_between(requester.id, target.id)
            reverse = await self.friend_repo.get_request_between(target.id, requester.id)
            if reverse and reverse.status == "pending":
                raise ValidationError("You already have a pending request from this user")
            if existing:
                if existing.status == "pending":
                    raise ValidationError("Friend request already sent")
                await self.friend_repo.reset_request(existing)
                return

            await self.friend_repo.create_request(requester.id, target.id)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error sending friend request: {e}")
            raise DatabaseError("Failed to send friend request")

    async def list_requests(self, current_user_id: str):
        user = await self._get_user_by_supabase_id(current_user_id)
        return await self.friend_repo.list_pending_requests(user.id)

    async def respond_request(self, current_user_id: str, request_id: int, action: str):
        try:
            user = await self._get_user_by_supabase_id(current_user_id)
            request = await self.friend_repo.get_request_by_id(request_id)
            if not request:
                raise ValidationError("Friend request not found")
            if request.addressee_id != user.id:
                raise ValidationError("Not allowed to respond to this request")
            if request.status != "pending":
                raise ValidationError("Friend request already handled")

            action_normalized = action.strip().lower()
            if action_normalized not in ("accept", "decline"):
                raise ValidationError("Invalid action")

            new_status = "accepted" if action_normalized == "accept" else "declined"
            await self.friend_repo.update_request_status(request, new_status)

            if new_status == "accepted":
                if not await self.friend_repo.get_friend(user.id, request.requester_id):
                    await self.friend_repo.create_friend(user.id, request.requester_id)
                if not await self.friend_repo.get_friend(request.requester_id, user.id):
                    await self.friend_repo.create_friend(request.requester_id, user.id)

            return request
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error responding to friend request: {e}")
            raise DatabaseError("Failed to respond to friend request")

    async def remove_friend(self, current_user_id: str, friend_user_id: str) -> None:
        try:
            user = await self._get_user_by_supabase_id(current_user_id)
            friend = await self._get_user_by_supabase_id(friend_user_id)
            await self.friend_repo.delete_friend(user.id, friend.id)
            await self.friend_repo.delete_friend(friend.id, user.id)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error removing friend: {e}")
            raise DatabaseError("Failed to remove friend")

    async def cleanup_user(self, supabase_user_id: str) -> None:
        user = await self.user_repo.get_by_supabase_user_id(supabase_user_id)
        if not user:
            return
        await self.friend_repo.delete_requests_for_user(user.id)
        await self.friend_repo.delete_all_for_user(user.id)
