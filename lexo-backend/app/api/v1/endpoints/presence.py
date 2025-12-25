from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import AuthenticatedUser, get_current_user
from app.dependencies import get_presence_service

router = APIRouter()


@router.post("/presence/ping")
def ping_presence(current_user: AuthenticatedUser = Depends(get_current_user)):
    presence_service = get_presence_service()
    presence_service.mark_online(current_user["user_id"])
    return {"success": True}


@router.get("/presence/status")
def presence_status(
    user_ids: list[str] = Query(default=[]),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    presence_service = get_presence_service()
    if not user_ids:
        return {"success": True, "online_user_ids": []}
    online_ids = presence_service.get_online_user_ids(user_ids)
    return {"success": True, "online_user_ids": online_ids}
