"""
backend/routers/projects.py
CRUD endpoints for Projects, plus their Notes/Draft (still embedded on the
project document) and Papers (normalized — see routers/papers.py for the
actual paper CRUD; this file just populates `papers` on read so the JSON
shape matches what the frontend already expects).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from db.mongo import get_db
from db.models import Project, ProjectCreate, ProjectUpdate, Draft
from deps import get_user_from_token

router = APIRouter(prefix="/projects", tags=["projects"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _attach_papers(db: AsyncIOMotorDatabase, project_docs: list[dict]) -> list[dict]:
    """Populate each project dict's `papers` field from the papers
    collection in one query (not N+1) — batches by projectId."""
    if not project_docs:
        return project_docs
    ids = [p["id"] for p in project_docs]
    papers = await db.papers.find({"projectId": {"$in": ids}}, {"_id": 0}).sort("added", 1).to_list(5000)
    by_project: dict[str, list[dict]] = {}
    for paper in papers:
        by_project.setdefault(paper["projectId"], []).append(paper)
    for p in project_docs:
        p["papers"] = by_project.get(p["id"], [])
    return project_docs


# ─── Projects ────────────────────────────────────────────────────
@router.get("", response_model=list[Project])
async def list_projects(user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    userId = user["id"] if user else "guest"
    docs = await db.projects.find({"userId": userId}, {"_id": 0}).sort("createdAt", -1).to_list(500)
    return await _attach_papers(db, docs)


@router.post("", response_model=Project, status_code=201)
async def create_project(body: ProjectCreate, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    userId = user["id"] if user else "guest"
    project = Project(id=str(uuid.uuid4()), userId=userId, name=body.name, description=body.description)
    doc = project.model_dump()
    doc.pop("papers", None)  # papers live in their own collection, never on this doc
    await db.projects.insert_one(doc)
    return project  # papers is already [] on a brand-new project


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    userId = user["id"] if user else "guest"
    doc = await db.projects.find_one({"id": project_id, "userId": userId}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    [doc] = await _attach_papers(db, [doc])
    return doc


@router.patch("/{project_id}", response_model=Project)
async def update_project(project_id: str, body: ProjectUpdate, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    userId = user["id"] if user else "guest"
    result = await db.projects.find_one_and_update(
        {"id": project_id, "userId": userId}, {"$set": update}, projection={"_id": 0}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    [result] = await _attach_papers(db, [result])
    return result


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: str, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    userId = user["id"] if user else "guest"
    res = await db.projects.delete_one({"id": project_id, "userId": userId})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # Cascade-delete everything that references this project
    await db.papers.delete_many({"projectId": project_id})
    await db.chat_sessions.delete_many({"projectId": project_id})





# ─── Draft (RRL draft text + last reviewer result, still embedded) ─
@router.put("/{project_id}/draft", response_model=Draft)
async def save_draft(project_id: str, draft: Draft, user=Depends(get_user_from_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    userId = user["id"] if user else "guest"
    draft.updatedAt = _now_iso()
    res = await db.projects.update_one({"id": project_id, "userId": userId}, {"$set": {"draft": draft.model_dump()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return draft
