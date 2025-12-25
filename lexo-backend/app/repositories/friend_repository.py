from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.database import Friend, FriendRequest, User
from datetime import datetime


class FriendRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_friend(self, user_id: int, friend_id: int) -> Optional[Friend]:
        return (
            self.db.query(Friend)
            .filter(Friend.user_id == user_id, Friend.friend_id == friend_id)
            .first()
        )

    def list_friends(self, user_id: int) -> List[User]:
        return (
            self.db.query(User)
            .join(Friend, Friend.friend_id == User.id)
            .filter(Friend.user_id == user_id)
            .order_by(User.username.asc())
            .all()
        )

    def create_friend(self, user_id: int, friend_id: int) -> Friend:
        friend = Friend(user_id=user_id, friend_id=friend_id)
        self.db.add(friend)
        self.db.commit()
        self.db.refresh(friend)
        return friend

    def delete_friend(self, user_id: int, friend_id: int) -> None:
        self.db.query(Friend).filter(
            Friend.user_id == user_id,
            Friend.friend_id == friend_id
        ).delete()
        self.db.commit()

    def delete_all_for_user(self, user_id: int) -> None:
        self.db.query(Friend).filter(
            (Friend.user_id == user_id) | (Friend.friend_id == user_id)
        ).delete()
        self.db.commit()

    def get_request_between(self, requester_id: int, addressee_id: int) -> Optional[FriendRequest]:
        return (
            self.db.query(FriendRequest)
            .filter(
                FriendRequest.requester_id == requester_id,
                FriendRequest.addressee_id == addressee_id,
            )
            .first()
        )

    def get_request_by_id(self, request_id: int) -> Optional[FriendRequest]:
        return self.db.query(FriendRequest).filter(FriendRequest.id == request_id).first()

    def list_pending_requests(self, addressee_id: int) -> List[FriendRequest]:
        return (
            self.db.query(FriendRequest)
            .filter(
                FriendRequest.addressee_id == addressee_id,
                FriendRequest.status == "pending",
            )
            .order_by(FriendRequest.created_at.desc())
            .all()
        )

    def create_request(self, requester_id: int, addressee_id: int) -> FriendRequest:
        request = FriendRequest(requester_id=requester_id, addressee_id=addressee_id)
        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)
        return request

    def update_request_status(self, request: FriendRequest, status: str) -> FriendRequest:
        request.status = status
        request.responded_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(request)
        return request

    def reset_request(self, request: FriendRequest) -> FriendRequest:
        request.status = "pending"
        request.responded_at = None
        self.db.commit()
        self.db.refresh(request)
        return request

    def delete_requests_for_user(self, user_id: int) -> None:
        self.db.query(FriendRequest).filter(
            (FriendRequest.requester_id == user_id) | (FriendRequest.addressee_id == user_id)
        ).delete()
        self.db.commit()
