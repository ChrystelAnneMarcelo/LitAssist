#!/usr/bin/env python
"""One-off script to remove chat sessions owned by the shared 'guest' user.

Usage:
  python backend/scripts/cleanup_guest_chats.py

Set MONGODB_URI and MONGODB_DB_NAME in the environment or in backend/.env.
"""
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "litassist")


async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    res = await db.chat_sessions.delete_many({"userId": "guest"})
    print(f"Deleted {res.deleted_count} guest chat_sessions")
    # AsyncIOMotorClient.close() is synchronous; do not await it.
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
