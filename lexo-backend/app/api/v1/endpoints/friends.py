from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.dependencies.auth import AuthenticatedUser, get_current_user
from app.core.exceptions import DatabaseError, ValidationError
from app.database.session import get_db
from app.models.schemas import (
    FriendRequestCreate,
    FriendRequestRespond,
    FriendInviteSend,
    FriendInviteRespond,
    FriendInviteCancel,
)
from app.services.user_service import UserService
from app.services.friend_service import FriendService
from app.dependencies import get_matchmaking_service
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


def ensure_user_exists(db: Session, current_user: AuthenticatedUser) -> None:
    claims = current_user.get("claims") or {}
    user_metadata = claims.get("user_metadata", {}) or {}
    username = (
        user_metadata.get("username")
        or user_metadata.get("name")
        or claims.get("email", "").split("@")[0]
        or "Player"
    )
    email = claims.get("email")

    user_service = UserService(db)
    user_service.create_or_get_user(current_user["user_id"], username, email)


@router.get("/friends/search")
def search_users(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        users = friend_service.search_users(current_user["user_id"], q)
        return {
            "success": True,
            "users": [
                {"user_id": user.supabase_user_id, "username": user.username}
                for user in users
            ],
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error searching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to search users")


@router.get("/friends")
def list_friends(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        friends = friend_service.list_friends(current_user["user_id"])
        return {
            "success": True,
            "friends": [
                {"user_id": friend.supabase_user_id, "username": friend.username}
                for friend in friends
            ],
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error listing friends: {e}")
        raise HTTPException(status_code=500, detail="Failed to list friends")


@router.get("/friends/requests")
def list_friend_requests(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        requests = friend_service.list_requests(current_user["user_id"])
        return {
            "success": True,
            "requests": [
                {
                    "id": request.id,
                    "status": request.status,
                    "created_at": request.created_at.isoformat(),
                    "requester": {
                        "user_id": request.requester.supabase_user_id,
                        "username": request.requester.username,
                    },
                }
                for request in requests
            ],
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error listing friend requests: {e}")
        raise HTTPException(status_code=500, detail="Failed to list friend requests")


@router.post("/friends/requests")
def send_friend_request(
    request: FriendRequestCreate,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        friend_service.send_request(current_user["user_id"], request.target_user_id)
        return {
            "success": True,
            "message": "Friend request sent"
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabaseError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending friend request: {e}")
        raise HTTPException(status_code=500, detail="Failed to send friend request")


@router.post("/friends/requests/{request_id}/respond")
def respond_friend_request(
    request_id: int,
    payload: FriendRequestRespond,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        request = friend_service.respond_request(current_user["user_id"], request_id, payload.action)
        return {
            "success": True,
            "status": request.status
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabaseError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error responding to friend request: {e}")
        raise HTTPException(status_code=500, detail="Failed to respond to friend request")


@router.delete("/friends/{friend_user_id}")
def remove_friend(
    friend_user_id: str,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        friend_service = FriendService(db)
        friend_service.remove_friend(current_user["user_id"], friend_user_id)
        return {
            "success": True,
            "message": "Friend removed"
        }
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabaseError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error removing friend: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove friend")


@router.post("/friends/invites/cancel")
async def cancel_friend_invite(
    payload: FriendInviteCancel,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        matchmaking_service = get_matchmaking_service()
        invite = matchmaking_service.cancel_invite_by_inviter(current_user["user_id"])
        if not invite or invite.get("invite_id") != payload.invite_id:
            return {"success": True, "cancelled": False}

        return {"success": True, "cancelled": True}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling friend invite: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel invite")


@router.post("/friends/invites/send")
async def send_friend_invite(
    payload: FriendInviteSend,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        matchmaking_service = get_matchmaking_service()
        user_service = UserService(db)
        inviter = user_service.get_user_by_supabase_id(current_user["user_id"])
        target = user_service.get_user_by_supabase_id(payload.target_user_id)
        if not inviter or not target:
            raise ValidationError("User not found")

        invite = matchmaking_service.create_invite(
            inviter.supabase_user_id,
            inviter.username,
            target.supabase_user_id,
            target.username,
        )

        target_notify = matchmaking_service.get_notification(payload.target_user_id)
        if target_notify:
            await target_notify.send_json({
                "type": "friend_invite",
                "invite_id": invite["invite_id"],
                "from_user_id": inviter.supabase_user_id,
                "from_username": inviter.username
            })

        return {"success": True, "invite_id": invite["invite_id"]}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending friend invite: {e}")
        raise HTTPException(status_code=500, detail="Failed to send invite")


@router.get("/friends/invites/active")
def get_active_invite(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    ensure_user_exists(db, current_user)
    matchmaking_service = get_matchmaking_service()
    invite = matchmaking_service.get_active_invite_for_user(current_user["user_id"])
    if not invite:
        return {"success": True, "invite": None}
    return {
        "success": True,
        "invite": {
            "invite_id": invite["invite_id"],
            "from_user_id": invite["inviter_id"],
            "from_username": invite["inviter_name"],
        },
    }


@router.post("/friends/invites/respond")
async def respond_friend_invite(
    payload: FriendInviteRespond,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    try:
        ensure_user_exists(db, current_user)
        matchmaking_service = get_matchmaking_service()
        invite = matchmaking_service.friend_invites.get(payload.invite_id)
        if not invite:
            raise ValidationError("Invite not found")
        if invite["target_id"] != current_user["user_id"]:
            raise ValidationError("Not allowed")

        action = payload.action.strip().lower()
        if action not in ("accept", "decline"):
            raise ValidationError("Invalid action")

        if action == "accept":
            invite["status"] = "accepted"
            inviter_notify = matchmaking_service.get_notification(invite["inviter_id"])
            if inviter_notify:
                await inviter_notify.send_json({
                    "type": "friend_invite_accepted",
                    "invite_id": invite["invite_id"],
                    "from_user_id": invite["target_id"],
                    "from_username": invite["target_name"],
                })
        else:
            matchmaking_service.set_invite_status(payload.invite_id, "declined")
            inviter_notify = matchmaking_service.get_notification(invite["inviter_id"])
            if inviter_notify:
                await inviter_notify.send_json({
                    "type": "friend_invite_declined",
                    "invite_id": invite["invite_id"],
                    "message": "Davet reddedildi"
                })

        return {"success": True, "status": action}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error responding friend invite: {e}")
        raise HTTPException(status_code=500, detail="Failed to respond invite")


@router.get("/friends/invites/status/{invite_id}")
def invite_status(
    invite_id: str,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    ensure_user_exists(db, current_user)
    matchmaking_service = get_matchmaking_service()
    invite = matchmaking_service.friend_invites.get(invite_id)
    if not invite:
        return {"success": True, "status": "missing"}
    if current_user["user_id"] not in (invite["inviter_id"], invite["target_id"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return {"success": True, "status": invite.get("status", "pending")}
