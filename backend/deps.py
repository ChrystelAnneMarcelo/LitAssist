from typing import Optional
from datetime import datetime, timezone
from fastapi import Header, Depends, Cookie
from motor.motor_asyncio import AsyncIOMotorDatabase
from db.mongo import get_db


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_user_from_token(x_auth_token: Optional[str] = Header(None), session_cookie: Optional[str] = Cookie(None, alias="litassist_session"), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Resolve an authenticated user by the X-Auth-Token header.
    Returns None when no valid token is provided (falls back to guest).
    """
    if db is None:
        db = get_db()
    token = x_auth_token or session_cookie
    if not token:
        return None
    doc = await db.users.find_one({"sessionToken": token}, {"_id": 0})
    if not doc:
        return None
    # check expiry if present
    expiry = doc.get("sessionExpiry")
    if expiry:
        try:
            exp_dt = datetime.fromisoformat(expiry)
            if exp_dt < datetime.now(timezone.utc):
                return None
        except Exception:
            pass
    return doc
