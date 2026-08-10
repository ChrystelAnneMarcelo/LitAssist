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

    # gather user ids
    users = await db.users.find({}, {"id": 1}).to_list(None)
    user_ids = [u["id"] for u in users]
    print(f"Found {len(user_ids)} users to remove")

    if user_ids:
        # delete related docs
        p_res = await db.projects.delete_many({"userId": {"$in": user_ids}})
        papers_res = await db.papers.delete_many({"projectId": {"$in": [p for p in []]}})  # no-op placeholder
        chats_res = await db.chat_sessions.delete_many({"userId": {"$in": user_ids}})
        # delete users
        u_res = await db.users.delete_many({})

        print(f"Deleted projects: {p_res.deleted_count}")
        print(f"Deleted chats: {chats_res.deleted_count}")
        print(f"Deleted users: {u_res.deleted_count}")
    else:
        print("No users found; nothing to delete")

    client.close()

if __name__ == '__main__':
    asyncio.run(main())
