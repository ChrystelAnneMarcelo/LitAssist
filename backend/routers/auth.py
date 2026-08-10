import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Response, Cookie
from motor.motor_asyncio import AsyncIOMotorDatabase

from db.mongo import get_db
from db.models import UserCreate, User

router = APIRouter(prefix="/auth", tags=["auth"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: bytes) -> str:
    # PBKDF2-HMAC-SHA256
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return dk.hex()


@router.post("/signup")
async def signup(body: UserCreate, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = body.email.strip().lower()
    # enforce simple email/password presence
    if not email or not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    # check exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    salt = os.urandom(16)
    pwd_hash = _hash_password(body.password, salt)
    user_id = str(uuid.uuid4())
    token = str(uuid.uuid4())
    expiry_dt = datetime.now(timezone.utc) + timedelta(days=30)
    expiry = expiry_dt.isoformat()
    user = User(id=user_id, email=email, passwordHash=pwd_hash, salt=salt.hex(), sessionToken=token, sessionExpiry=expiry)
    await db.users.insert_one(user.model_dump())

    # Set httpOnly cookie for session
    # In production prefer Secure + SameSite=None for cross-site cases; in dev keep SameSite=lax
    secure_cookies = os.getenv("ENV", "development") == "production" or os.getenv("SECURE_COOKIES") == "1"
    samesite_mode = "none" if secure_cookies else "lax"
    response.set_cookie(key="litassist_session", value=token, httponly=True, samesite=samesite_mode, secure=secure_cookies, path="/", expires=int(expiry_dt.timestamp()))
    return {"email": email}


@router.post("/login")
async def login(body: UserCreate, response: Response, db: AsyncIOMotorDatabase = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or not body.password:
        raise HTTPException(status_code=400, detail="Invalid email or password")

    doc = await db.users.find_one({"email": email})
    if not doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    salt = bytes.fromhex(doc["salt"])
    expected = doc["passwordHash"]
    provided = _hash_password(body.password, salt)
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = str(uuid.uuid4())
    expiry_dt = datetime.now(timezone.utc) + timedelta(days=30)
    expiry = expiry_dt.isoformat()
    await db.users.update_one({"email": email}, {"$set": {"sessionToken": token, "sessionExpiry": expiry}})

    secure_cookies = os.getenv("ENV", "development") == "production" or os.getenv("SECURE_COOKIES") == "1"
    samesite_mode = "none" if secure_cookies else "lax"
    response.set_cookie(key="litassist_session", value=token, httponly=True, samesite=samesite_mode, secure=secure_cookies, path="/", expires=int(expiry_dt.timestamp()))
    return {"email": email}


@router.post("/logout")
async def logout(response: Response, session: str | None = Cookie(None, alias="litassist_session"), db: AsyncIOMotorDatabase = Depends(get_db)):
    token = session
    if token:
        await db.users.update_one({"sessionToken": token}, {"$set": {"sessionToken": None, "sessionExpiry": None}})
    # Clear cookie; mirror secure flag when deleting for proper removal in some browsers
    secure_cookies = os.getenv("ENV", "development") == "production" or os.getenv("SECURE_COOKIES") == "1"
    response.delete_cookie("litassist_session", path="/", secure=secure_cookies)
    return {"ok": True}


@router.get("/me")
async def me(session: str | None = Cookie(None, alias="litassist_session"), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    doc = await db.users.find_one({"sessionToken": session}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"email": doc.get("email")}
