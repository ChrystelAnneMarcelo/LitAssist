"""
backend/routers/chats.py
CRUD endpoints for ChatSessions and their embedded ChatMessages.

Mounted at /chats in main.py. Mirrors localStorage("litassist-chat-sessions").
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from db.mongo import get_db
from db.models import ChatSession, ChatSessionCreate, ChatMessage, ChatMessageCreate
from deps import get_user_from_token

router = APIRouter(prefix="/chats", tags=["chats"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("", response_model=list[ChatSession])
async def list_chats(
    projectId: str | None = None,
    user=Depends(get_user_from_token),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    userId = user["id"]
    query = {"userId": userId}
    if projectId:
        query["projectId"] = projectId
    docs = await db.chat_sessions.find(query, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return docs


@router.post("", response_model=ChatSession, status_code=201)
async def create_chat(body: ChatSessionCreate, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    userId = user["id"]
    session = ChatSession(id=str(uuid.uuid4()), userId=userId, projectId=body.projectId, title=body.title)
    await db.chat_sessions.insert_one(session.model_dump())
    return session


@router.get("/{chat_id}", response_model=ChatSession)
async def get_chat(chat_id: str, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    userId = user["id"]
    doc = await db.chat_sessions.find_one({"id": chat_id, "userId": userId}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return doc


@router.delete("/{chat_id}", status_code=204)
async def delete_chat(chat_id: str, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    userId = user["id"]
    res = await db.chat_sessions.delete_one({"id": chat_id, "userId": userId})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")


@router.post("/{chat_id}/messages", response_model=ChatMessage, status_code=201)
async def add_message(chat_id: str, body: ChatMessageCreate, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    userId = user["id"]
    message = ChatMessage(id=str(uuid.uuid4()), **body.model_dump())
    res = await db.chat_sessions.update_one({"id": chat_id, "userId": userId}, {"$push": {"messages": message.model_dump()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Chat session not found")
    return message
