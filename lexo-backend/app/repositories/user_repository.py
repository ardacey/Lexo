from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.models.database import User
from app.repositories.base import BaseRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class UserRepository(BaseRepository[User]):

    def __init__(self, db: AsyncSession):
        super().__init__(User, db)

    async def get_by_supabase_user_id(self, supabase_user_id: str, with_stats: bool = False) -> Optional[User]:
        stmt = select(User).where(User.supabase_user_id == supabase_user_id)
        if with_stats:
            stmt = stmt.options(selectinload(User.stats))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_multiple_by_ids(self, user_ids: List[int], with_stats: bool = False) -> List[User]:
        stmt = select(User).where(User.id.in_(user_ids))
        if with_stats:
            stmt = stmt.options(selectinload(User.stats))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_user(
        self,
        supabase_user_id: str,
        username: str,
        email: Optional[str] = None
    ) -> User:
        user = User(supabase_user_id=supabase_user_id, username=username, email=email)
        return await self.create(user)

    async def update_last_login(self, user: User) -> User:
        user.last_login = datetime.utcnow()
        return await self.update(user)

    async def get_or_create(
        self,
        supabase_user_id: str,
        username: str,
        email: Optional[str] = None
    ) -> tuple[User, bool]:
        user = await self.get_by_supabase_user_id(supabase_user_id)
        if user:
            await self.update_last_login(user)
            logger.info(f"User logged in: {username}")
            return user, False
        user = await self.create_user(supabase_user_id, username, email)
        logger.info(f"Created new user: {username} (supabase_user_id: {supabase_user_id})")
        return user, True

    async def delete_by_supabase_user_id(self, supabase_user_id: str) -> bool:
        user = await self.get_by_supabase_user_id(supabase_user_id)
        if user:
            await self.db.delete(user)
            await self.db.commit()
            logger.info(f"Deleted user: {supabase_user_id}")
            return True
        return False
