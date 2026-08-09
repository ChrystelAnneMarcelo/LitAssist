"""
backend/routers/papers.py
CRUD for Papers, stored in their own top-level `papers` collection and
linked to a project via the `projectId` foreign key (not embedded).

Mounted at /projects/{project_id}/papers in main.py — same URL shape the
frontend already expects from when papers were embedded, so no frontend
changes are needed even though the storage model underneath changed.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from db.mongo import get_db
from db.models import Paper, PaperCreate, PaperAnalysis

router = APIRouter(prefix="/projects/{project_id}/papers", tags=["papers"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _require_project(db: AsyncIOMotorDatabase, project_id: str) -> None:
    exists = await db.projects.find_one({"id": project_id}, {"_id": 1})
    if not exists:
        raise HTTPException(status_code=404, detail="Project not found")


@router.get("", response_model=list[Paper])
async def list_papers(project_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    await _require_project(db, project_id)
    return await db.papers.find({"projectId": project_id}, {"_id": 0}).sort("added", 1).to_list(5000)


@router.post("", response_model=Paper, status_code=201)
async def add_paper(project_id: str, body: PaperCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    await _require_project(db, project_id)
    paper = Paper(id=str(uuid.uuid4()), projectId=project_id, **body.model_dump())
    if not paper.added:
        paper.added = _now_iso()
    await db.papers.insert_one(paper.model_dump())
    return paper


@router.patch("/{paper_id}", response_model=Paper)
async def update_paper(project_id: str, paper_id: str, body: PaperCreate, db: AsyncIOMotorDatabase = Depends(get_db)):
    update = body.model_dump()
    result = await db.papers.find_one_and_update(
        {"id": paper_id, "projectId": project_id},
        {"$set": update},
        projection={"_id": 0},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Paper not found in this project")
    return result


@router.patch("/{paper_id}/analysis", response_model=Paper)
async def save_paper_analysis(
    project_id: str, paper_id: str, analysis: PaperAnalysis, db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Persist a Summarize & Score result onto its paper. Separate from the
    general PATCH /{paper_id} (which replaces the whole PaperCreate body) so
    the frontend can save just the analysis slice without resending title,
    authors, abstract, etc."""
    analysis.analyzedAt = _now_iso()
    result = await db.papers.find_one_and_update(
        {"id": paper_id, "projectId": project_id},
        {"$set": {"analysis": analysis.model_dump()}},
        projection={"_id": 0},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Paper not found in this project")
    return result


@router.delete("/{paper_id}", status_code=204)
async def delete_paper(project_id: str, paper_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    res = await db.papers.delete_one({"id": paper_id, "projectId": project_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paper not found in this project")
