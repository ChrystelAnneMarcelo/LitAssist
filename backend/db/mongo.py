"""
backend/db/mongo.py
Motor (async MongoDB driver) connection management.

Reads MONGODB_URI and MONGODB_DB_NAME from the environment (backend/.env).
Call `connect_to_mongo()` on app startup and `close_mongo_connection()` on
shutdown (already wired into main.py's lifespan handler).

Indexes are created once at startup via `ensure_indexes()`.
"""
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "litassist")

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global client, db
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]
    # Fail fast on bad connection strings instead of on the first query
    await client.admin.command("ping")
    await ensure_indexes()
    print(f"✅ MongoDB connected → db={MONGODB_DB_NAME} @ {_mask_uri(MONGODB_URI)}")


def _mask_uri(uri: str) -> str:
    """Hide the password in logs — e.g. mongodb+srv://user:***@cluster.mongodb.net"""
    import re
    return re.sub(r"(://[^:]+:)[^@]+(@)", r"\1***\2", uri)


async def close_mongo_connection() -> None:
    global client
    if client:
        client.close()
        print("⛔ MongoDB connection closed.")


async def ensure_indexes() -> None:
    """Create indexes idempotently. Safe to call on every startup."""
    assert db is not None

    # projects: scope by user, sort by recency
    await db.projects.create_index("userId")
    await db.projects.create_index([("userId", 1), ("createdAt", -1)])

    # papers: own collection now — fast lookup of "all papers in a project",
    # and a unique id so cross-project id collisions can't happen
    await db.papers.create_index([("projectId", 1), ("added", 1)])
    await db.papers.create_index("id", unique=True)

    # chat_sessions: fetch all sessions for a project, most-recent-first
    # (messages stay embedded — no separate collection/index needed for them)
    await db.chat_sessions.create_index([("projectId", 1), ("createdAt", -1)])
    await db.chat_sessions.create_index("userId")
    # users: unique email
    await db.users.create_index("email", unique=True)


def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency: yields the active database handle."""
    assert db is not None, "MongoDB not initialized — did the app startup lifespan run?"
    return db
