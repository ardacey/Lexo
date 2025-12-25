from typing import List
import re
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.exceptions import DatabaseError, ValidationError
from app.models.database import User
from app.repositories.friend_repository import FriendRepository
from app.repositories.user_repository import UserRepository
from app.core.logging import get_logger

logger = get_logger(__name__)


class FriendService:
    def __init__(self, db: Session):
        self.db = db
        self.friend_repo = FriendRepository(db)
        self.user_repo = UserRepository(db)

    def _get_user_by_supabase_id(self, supabase_user_id: str) -> User:
        user = self.user_repo.get_by_supabase_user_id(supabase_user_id)
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

    def search_users(self, current_user_id: str, query: str, limit: int = 10) -> List[User]:
        user = self._get_user_by_supabase_id(current_user_id)
        if not query:
            return []
        pattern = self._build_turkish_pattern(query)
        return (
            self.db.query(User)
            .filter(
                or_(
                    User.username.ilike(f"%{query}%"),
                    User.username.op("~")(pattern),
                )
            )
            .filter(User.id != user.id)
            .order_by(User.username.asc())
            .limit(limit)
            .all()
        )

    def list_friends(self, current_user_id: str) -> List[User]:
        user = self._get_user_by_supabase_id(current_user_id)
        return self.friend_repo.list_friends(user.id)

    def send_request(self, current_user_id: str, target_user_id: str) -> None:
        try:
            requester = self._get_user_by_supabase_id(current_user_id)
            target = self._get_user_by_supabase_id(target_user_id)

            if requester.id == target.id:
                raise ValidationError("Cannot send friend request to yourself")

            if self.friend_repo.get_friend(requester.id, target.id):
                raise ValidationError("You are already friends")

            existing = self.friend_repo.get_request_between(requester.id, target.id)
            reverse = self.friend_repo.get_request_between(target.id, requester.id)
            if reverse and reverse.status == "pending":
                raise ValidationError("You already have a pending request from this user")
            if existing:
                if existing.status == "pending":
                    raise ValidationError("Friend request already sent")
                self.friend_repo.reset_request(existing)
                return

            self.friend_repo.create_request(requester.id, target.id)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error sending friend request: {e}")
            raise DatabaseError("Failed to send friend request")

    def list_requests(self, current_user_id: str):
        user = self._get_user_by_supabase_id(current_user_id)
        return self.friend_repo.list_pending_requests(user.id)

    def respond_request(self, current_user_id: str, request_id: int, action: str):
        try:
            user = self._get_user_by_supabase_id(current_user_id)
            request = self.friend_repo.get_request_by_id(request_id)
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
            self.friend_repo.update_request_status(request, new_status)

            if new_status == "accepted":
                if not self.friend_repo.get_friend(user.id, request.requester_id):
                    self.friend_repo.create_friend(user.id, request.requester_id)
                if not self.friend_repo.get_friend(request.requester_id, user.id):
                    self.friend_repo.create_friend(request.requester_id, user.id)

            return request
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error responding to friend request: {e}")
            raise DatabaseError("Failed to respond to friend request")

    def remove_friend(self, current_user_id: str, friend_user_id: str) -> None:
        try:
            user = self._get_user_by_supabase_id(current_user_id)
            friend = self._get_user_by_supabase_id(friend_user_id)
            self.friend_repo.delete_friend(user.id, friend.id)
            self.friend_repo.delete_friend(friend.id, user.id)
        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Error removing friend: {e}")
            raise DatabaseError("Failed to remove friend")

    def cleanup_user(self, supabase_user_id: str) -> None:
        user = self.user_repo.get_by_supabase_user_id(supabase_user_id)
        if not user:
            return
        self.friend_repo.delete_requests_for_user(user.id)
        self.friend_repo.delete_all_for_user(user.id)
