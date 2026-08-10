"""
backend/db/models.py
Pydantic v2 models for MongoDB documents.

These mirror the shared frontend types in types/index.ts (Paper, Project,
ChatMessage, ChatSession) so the JSON shape returned by the API matches what
AppShell.tsx already expects — no frontend type changes required, only
swapping localStorage read/writes for fetch() calls.

Design notes:
  - Papers live in their OWN "papers" collection, referenced by projectId
    (a normalized foreign key, not embedded). Reasoning: papers are the one
    sub-resource with plausible future needs — sharing a paper across
    projects, searching/filtering papers globally — that embedding would
    make awkward. The Project model below still exposes a `papers: list`
    field so the JSON shape returned to the frontend is unchanged (it's
    populated at read time by routers/projects.py querying the papers
    collection), but nothing under `papers` is stored inside the project
    document itself.
  - Chat messages stay embedded inside their ChatSession document. None of
    the reasons that justify normalizing papers apply to messages: a
    message never needs to be shared or queried outside its session, and
    session sizes are small and bounded (a handful of RRL Q&A turns), so
    there's no pagination or document-size concern. Every read of a session
    wants all its messages at once, so keeping them embedded avoids a join
    for zero benefit.
  - Mongo's ObjectId is never exposed to the frontend. Every document keeps
    its own app-level "id" string (uuid, generated client-side today) as the
    externally visible primary key, so existing frontend id generation
    (crypto.randomUUID() etc.) keeps working unchanged. Mongo's _id is kept
    only as the internal index key.
"""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Paper analysis (Summarize & Score result, one per paper) ──
class PaperAnalysis(BaseModel):
    summary: str = ""
    keyFindings: list[str] = Field(default_factory=list)
    methodology: str = ""
    researchGap: str = ""
    relevanceScore: int = 0
    topicRelevanceScore: Optional[int] = None
    topicRelevanceRationale: Optional[str] = None
    methodologicalRigorScore: Optional[int] = None
    methodologicalRigorRationale: Optional[str] = None
    overallRrlRationale: Optional[str] = None
    themes: list[str] = Field(default_factory=list)
    analyzedAt: str = Field(default_factory=_now_iso)


# ─── Paper (own collection now; projectId is the foreign key) ──
class Paper(BaseModel):
    id: str
    projectId: str
    title: str
    authors: str
    added: str = Field(default_factory=_now_iso)
    abstract: str = ""
    methodology: str = ""
    keyFindings: list[str] = Field(default_factory=list)
    year: str = ""
    journal: str = ""
    tags: list[str] = Field(default_factory=list)
    doi: Optional[str] = None
    url: Optional[str] = None
    pdfUrl: Optional[str] = None
    analysis: Optional[PaperAnalysis] = None


class PaperCreate(BaseModel):
    """Body for POST /projects/{project_id}/papers — projectId is taken
    from the URL, not the client, so it can't be forged/mismatched."""
    title: str
    authors: str
    added: str = Field(default_factory=_now_iso)
    abstract: str = ""
    methodology: str = ""
    keyFindings: list[str] = Field(default_factory=list)
    year: str = ""
    journal: str = ""
    tags: list[str] = Field(default_factory=list)
    doi: Optional[str] = None
    url: Optional[str] = None
    pdfUrl: Optional[str] = None


# ─── Draft (RRL draft + last review result, one per project) ───
class CriteriaScores(BaseModel):
    depth: int = 0
    structure: int = 0
    citations: int = 0
    scope: int = 0


class ReviewResult(BaseModel):
    score: int
    feedback: str
    criteriaScores: Optional[CriteriaScores] = None
    trace: list[str] = Field(default_factory=list)
    latencyMs: int = 0
    modelName: str = "gemini-2.5-flash"
    tokens: dict = Field(default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0})
    retries: int = 0


class Draft(BaseModel):
    text: str = ""
    reviewResult: Optional[ReviewResult] = None
    updatedAt: str = Field(default_factory=_now_iso)


# ─── Project (top-level document; notes/draft embedded, papers NOT) ─
class Project(BaseModel):
    """`papers` is populated at read time from the papers collection
    (see routers/projects.py) — it is never written into the stored
    project document. It's kept on this model purely to shape the API
    response so the frontend's existing Project type still matches."""
    model_config = ConfigDict(populate_by_name=True)

    id: str
    userId: str = "guest"  # single-user today; ready for auth later
    name: str
    description: str = ""
    createdAt: str = Field(default_factory=_now_iso)
    papers: list[Paper] = Field(default_factory=list)
    notes: str = ""
    draft: Draft = Field(default_factory=Draft)


class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ─── Chat message / session ─────────────────────────────────────
class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0
    total: int = 0


class ChatMessage(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    timestamp: str = Field(default_factory=_now_iso)
    trace: Optional[list[str]] = None
    tokens: Optional[TokenUsage] = None
    reviewScore: Optional[int] = None
    latencyMs: Optional[int] = None
    retries: Optional[int] = None
    modelName: Optional[str] = None


class ChatMessageCreate(BaseModel):
    """Body for POST /chats/{chat_id}/messages — id is server-generated,
    same reasoning as PaperCreate: never trust a client-supplied primary key."""
    role: str
    content: str
    timestamp: str = Field(default_factory=_now_iso)
    trace: Optional[list[str]] = None
    tokens: Optional[TokenUsage] = None
    reviewScore: Optional[int] = None
    latencyMs: Optional[int] = None
    retries: Optional[int] = None
    modelName: Optional[str] = None


class ChatSession(BaseModel):
    id: str
    userId: str = "guest"
    projectId: str
    title: str
    createdAt: str = Field(default_factory=_now_iso)
    messages: list[ChatMessage] = Field(default_factory=list)


class ChatSessionCreate(BaseModel):
    projectId: str
    title: str = "New RRL Chat"


# ─── User (authentication) ─────────────────────────────────
class User(BaseModel):
    id: str
    email: str
    passwordHash: str
    salt: str
    createdAt: str = Field(default_factory=_now_iso)
    sessionToken: Optional[str] = None
    sessionExpiry: Optional[str] = None


class UserCreate(BaseModel):
    email: str
    password: str
