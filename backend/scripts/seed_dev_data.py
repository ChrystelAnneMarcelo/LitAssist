import asyncio
import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import hashlib


load_dotenv()
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "litassist")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: bytes) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return dk.hex()


async def main():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[MONGODB_DB_NAME]

    # Seed user
    seed_email = os.getenv("DEV_SEED_EMAIL", "dev_seed@example.com")
    seed_password = os.getenv("DEV_SEED_PW", "SeedPass123!")

    existing = await db.users.find_one({"email": seed_email})
    if existing:
        print(f"Seed user {seed_email} already exists (id={existing.get('id')})")
        user_id = existing.get("id")
    else:
        salt = os.urandom(16)
        pwd_hash = _hash_password(seed_password, salt)
        user_id = str(uuid.uuid4())
        user = {
            "id": user_id,
            "email": seed_email,
            "passwordHash": pwd_hash,
            "salt": salt.hex(),
            "createdAt": _now_iso(),
            "sessionToken": None,
            "sessionExpiry": None,
        }
        await db.users.insert_one(user)
        print(f"Created seed user {seed_email} id={user_id}")

    # Create two projects with papers and a chat each
    projects = []
    for i in (1, 2):
        pname = f"Dev Seed Project {i}"
        existing_p = await db.projects.find_one({"name": pname, "userId": user_id})
        if existing_p:
            print(f"Project already exists: {pname}")
            project_id = existing_p["id"]
        else:
            project_id = str(uuid.uuid4())
            proj_doc = {
                "id": project_id,
                "userId": user_id,
                "name": pname,
                "description": "Seed project for local development",
                "createdAt": _now_iso(),
                "papers": [],
                "notes": "",
                "draft": {"text": "", "reviewResult": None, "updatedAt": _now_iso()},
            }
            await db.projects.insert_one(proj_doc)
            print(f"Created project: {pname} ({project_id})")

        # Remove legacy placeholder sample papers for this project (idempotent cleanup)
        await db.papers.delete_many({"projectId": project_id, "title": {"$regex": "^Sample Paper"}})

        # Add two sample papers per project using well-known research metadata
        # These are factual metadata entries (title, authors, year, doi, short summary)
        if i == 1:
            sample_papers = [
                {
                    "id": str(uuid.uuid4()),
                    "projectId": project_id,
                    "title": "Attention Is All You Need",
                    "authors": "Ashish Vaswani; Noam Shazeer; Niki Parmar; Jakob Uszkoreit; Llion Jones; Aidan N Gomez; \nLukasz Kaiser; Illia Polosukhin",
                    "added": _now_iso(),
                    "summary": "Introduces the Transformer, a neural network architecture relying entirely on attention mechanisms, enabling parallelization and improved performance on sequence tasks.",
                    "year": "2017",
                    "venue": "NeurIPS",
                    "doi": "10.48550/arXiv.1706.03762",
                    "pdfUrl": "https://arxiv.org/abs/1706.03762",
                    "tags": ["nlp", "transformer"],
                },
                {
                    "id": str(uuid.uuid4()),
                    "projectId": project_id,
                    "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
                    "authors": "Jacob Devlin; Ming-Wei Chang; Kenton Lee; Kristina Toutanova",
                    "added": _now_iso(),
                    "summary": "Describes BERT, a method for pre-training deep bidirectional representations which improves many NLP tasks when fine-tuned.",
                    "year": "2018",
                    "venue": "NAACL",
                    "doi": "10.48550/arXiv.1810.04805",
                    "pdfUrl": "https://arxiv.org/abs/1810.04805",
                    "tags": ["nlp", "pretraining", "bert"],
                },
            ]
        else:
            sample_papers = [
                {
                    "id": str(uuid.uuid4()),
                    "projectId": project_id,
                    "title": "Deep Residual Learning for Image Recognition",
                    "authors": "Kaiming He; Xiangyu Zhang; Shaoqing Ren; Jian Sun",
                    "added": _now_iso(),
                    "summary": "Introduces residual connections (ResNets) which eased training of very deep neural networks and improved image recognition benchmarks.",
                    "year": "2015",
                    "venue": "CVPR",
                    "doi": "10.1109/CVPR.2016.90",
                    "pdfUrl": "https://arxiv.org/abs/1512.03385",
                    "tags": ["vision", "resnet"],
                },
                {
                    "id": str(uuid.uuid4()),
                    "projectId": project_id,
                    "title": "Adam: A Method for Stochastic Optimization",
                    "authors": "Diederik P. Kingma; Jimmy Ba",
                    "added": _now_iso(),
                    "summary": "Presents Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions, widely used for deep learning.",
                    "year": "2015",
                    "venue": "ICLR",
                    "doi": "10.48550/arXiv.1412.6980",
                    "pdfUrl": "https://arxiv.org/abs/1412.6980",
                    "tags": ["optimization", "deep-learning"],
                },
            ]

        for pap in sample_papers:
            # avoid duplicates by title for idempotent seeding
            exists_paper = await db.papers.find_one({"title": pap["title"], "projectId": project_id})
            if not exists_paper:
                # normalize fields to match Paper model
                paper_doc = {
                    "id": pap["id"],
                    "projectId": pap["projectId"],
                    "title": pap["title"],
                    "authors": pap.get("authors", "Unknown Author"),
                    "added": pap.get("added", _now_iso()),
                    "abstract": pap.get("summary", pap.get("abstract", "")),
                    "methodology": pap.get("methodology", ""),
                    "keyFindings": pap.get("key_findings", pap.get("keyFindings", [])),
                    "year": pap.get("year", pap.get("year", "")),
                    "journal": pap.get("venue", pap.get("journal", "")),
                    "tags": pap.get("tags", []),
                    "doi": pap.get("doi"),
                    "url": pap.get("url"),
                    "pdfUrl": pap.get("pdfUrl"),
                }
                await db.papers.insert_one(paper_doc)
            else:
                # ensure abstract/keyFindings/methodology exist for existing paper
                updates = {}
                if not exists_paper.get("abstract") and pap.get("summary"):
                    updates["abstract"] = pap["summary"]
                if not exists_paper.get("methodology") and pap.get("methodology"):
                    updates["methodology"] = pap["methodology"]
                if (not exists_paper.get("keyFindings") or len(exists_paper.get("keyFindings", []))==0) and pap.get("key_findings"):
                    updates["keyFindings"] = pap["key_findings"]
                if updates:
                    await db.papers.update_one({"id": exists_paper["id"]}, {"$set": updates})
        projects.append({"id": project_id, "name": pname})

        # Create a chat session for the project
        chat_exists = await db.chat_sessions.find_one({"projectId": project_id, "userId": user_id})
        if not chat_exists:
            chat_doc = {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "projectId": project_id,
                "title": f"Seed chat for {pname}",
                "createdAt": _now_iso(),
                "messages": [],
            }
            await db.chat_sessions.insert_one(chat_doc)
            print(f"Created chat for {pname}")

    print("Seed complete. Projects:", projects)
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
