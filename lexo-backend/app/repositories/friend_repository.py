from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.models.database import Friend, FriendRequest, User
from datetime import datetime


class FriendRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_friend(self, user_id: int, friend_id: int) -> Optional[Friend]:
        result = await self.db.execute(
            select(Friend).where(Friend.user_id == user_id, Friend.friend_id == friend_id)
        )
        return result.scalar_one_or_none()

    async def list_friends(self, user_id: int) -> List[User]:
        stmt = (
            select(User)
            .join(Friend, Friend.friend_id == User.id)
            .where(Friend.user_id == user_id)
            .order_by(User.username.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_friend(self, user_id: int, friend_id: int) -> Friend:
        friend = Friend(user_id=user_id, friend_id=friend_id)
        self.db.add(friend)
        await self.db.commit()
        await self.db.refresh(friend)
        return friend

    async def delete_friend(self, user_id: int, friend_id: int) -> None:
        await self.db.execute(
            delete(Friend).where(Friend.user_id == user_id, Friend.friend_id == friend_id)
        )
        await self.db.commit()

    async def delete_all_for_user(self, user_id: int) -> None:
        await self.db.execute(
            delete(Friend).where((Friend.user_id == user_id) | (Friend.friend_id == user_id))
        )
        await self.db.commit()

    async def get_request_between(self, requester_id: int, addressee_id: int) -> Optional[FriendRequest]:
        result = await self.db.execute(
            select(FriendRequest).where(
                FriendRequest.requester_id == requester_id,
                FriendRequest.addressee_id == addressee_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_request_by_id(self, request_id: int) -> Optional[FriendRequest]:
        result = await self.db.execute(
            select(FriendRequest).where(FriendRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def list_pending_requests(self, addressee_id: int) -> List[FriendRequest]:
        stmt = (
            select(FriendRequest)
            .options(selectinload(FriendRequest.requester))
            .where(
                FriendRequest.addressee_id == addressee_id,
                FriendRequest.status == "pending",
            )
            .order_by(FriendRequest.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_request(self, requester_id: int, addressee_id: int) -> FriendRequest:
        request = FriendRequest(requester_id=requester_id, addressee_id=addressee_id)
        self.db.add(request)
        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def update_request_status(self, request: FriendRequest, status: str) -> FriendRequest:
        request.status = status
        request.responded_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def reset_request(self, request: FriendRequest) -> FriendRequest:
        request.status = "pending"
        request.responded_at = None
        await self.db.commit()
        await self.db.refresh(request)
        return request

    async def delete_requests_for_user(self, user_id: int) -> None:
        await self.db.execute(
            delete(FriendRequest).where(
                (FriendRequest.requester_id == user_id) | (FriendRequest.addressee_id == user_id)
            )
        )
        await self.db.commit()
