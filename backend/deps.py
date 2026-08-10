import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import Header, Depends, Cookie, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from db.mongo import get_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_user_from_token(
    request: Request,
    x_auth_token: Optional[str] = Header(None),
    session_cookie: Optional[str] = Cookie(None, alias="litassist_session"),
    guest_cookie: Optional[str] = Cookie(None, alias="litassist_guest"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Resolve an authenticated user or an isolated anonymous guest session.
    If authenticated: returns the user document dict (containing 'id').
    If unauthenticated: returns a guest user dict with a unique guest session ID.
    """
    if db is None:
        db = get_db()
    token = x_auth_token or session_cookie
    if token:
        doc = await db.users.find_one({"sessionToken": token}, {"_id": 0})
        if doc:
            expiry = doc.get("sessionExpiry")
            if expiry:
                try:
                    exp_dt = datetime.fromisoformat(expiry)
                    if exp_dt >= datetime.now(timezone.utc):
                        return doc
                except Exception:
                    return doc
            else:
                return doc

    # Guest user: resolve unique guest session ID from cookie or request state
    guest_id = getattr(request.state, "new_guest_id", None) or guest_cookie
    if not guest_id or not str(guest_id).startswith("guest_"):
        guest_id = f"guest_{uuid.uuid4()}"

    return {"id": guest_id, "isGuest": True}
