import asyncio
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.models.database import User, GameHistory, UserStats, Friend, FriendRequest
from app.repositories.user_repository import UserRepository
from app.repositories.friend_repository import FriendRepository
from app.repositories.stats_repository import StatsRepository
from app.core.logging import get_logger
from app.core.exceptions import DatabaseError, ValidationError
from app.core.config import settings
from supabase import create_client, Client

logger = get_logger(__name__)


class UserService:

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.stats_repo = StatsRepository(db)
        self.friend_repo = FriendRepository(db)
        self._supabase: Optional[Client] = None

    def _get_supabase_client(self) -> Client:
        if self._supabase is None:
            self._supabase = create_client(
                settings.supabase.url,
                settings.supabase.service_role_key
            )
        return self._supabase

    async def create_or_get_user(
        self,
        supabase_user_id: str,
        username: str,
        email: Optional[str] = None
    ) -> User:
        try:
            user = await self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if user:
                await self.user_repo.update_last_login(user)
                return user

            if await self.user_repo.get_by_username(username):
                raise ValidationError(f"Username '{username}' is already taken")

            if email and await self.user_repo.get_by_email(email):
                raise ValidationError(f"Email '{email}' is already registered")

            user = await self.user_repo.create_user(supabase_user_id, username, email)
            await self.stats_repo.create_for_user(user.id)

            return user
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error creating/getting user {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to create/get user: {str(e)}")

    async def get_user_by_supabase_id(self, supabase_user_id: str) -> Optional[User]:
        return await self.user_repo.get_by_supabase_user_id(supabase_user_id)

    async def get_user_by_username(self, username: str) -> Optional[User]:
        return await self.user_repo.get_by_username(username)

    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        return await self.user_repo.get_by_id(user_id)

    async def update_username(self, supabase_user_id: str, username: str) -> User:
        try:
            user = await self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if not user:
                raise ValidationError("User not found")

            if user.username == username:
                return user

            if await self.user_repo.get_by_username(username):
                raise ValidationError(f"Username '{username}' is already taken")

            user.username = username
            return await self.user_repo.update(user)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error updating username for {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to update username: {str(e)}")

    async def delete_user(self, supabase_user_id: str) -> bool:
        try:
            user = await self.user_repo.get_by_supabase_user_id(supabase_user_id)
            if not user:
                return False

            # Delete all related data in a single transaction
            await self.db.execute(
                delete(GameHistory).where(
                    (GameHistory.player1_id == user.id) | (GameHistory.player2_id == user.id)
                )
            )
            await self.db.execute(delete(UserStats).where(UserStats.user_id == user.id))
            await self.db.execute(
                delete(FriendRequest).where(
                    (FriendRequest.requester_id == user.id) | (FriendRequest.addressee_id == user.id)
                )
            )
            await self.db.execute(
                delete(Friend).where(
                    (Friend.user_id == user.id) | (Friend.friend_id == user.id)
                )
            )
            await self.db.delete(user)
            await self.db.commit()

            try:
                supabase = self._get_supabase_client()
                await asyncio.to_thread(supabase.auth.admin.delete_user, supabase_user_id)
                logger.info(f"Deleted Supabase auth user: {supabase_user_id}")
            except Exception as auth_error:
                logger.error(f"Failed to delete Supabase auth user {supabase_user_id}: {auth_error}")

            return True
        except Exception as e:
            logger.error(f"Error deleting user {supabase_user_id}: {e}")
            raise DatabaseError(f"Failed to delete user: {str(e)}")
