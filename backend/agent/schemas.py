"""
backend/agent/schemas.py
Pydantic v2 models for LitAssist agent input/output validation.
Equivalent to lib/agent/schemas.ts (Zod) on the TypeScript side.
"""
from typing import Optional
from pydantic import BaseModel, Field


# ─── Input models ──────────────────────────────────────────────
class Paper(BaseModel):
    id: str
    title: str
    authors: str
    year: str | int = ""
    journal: str = ""
    abstract: str = ""
    methodology: str = ""
    keyFindings: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    added: str = ""


class ChatInput(BaseModel):
    question: str = Field(default="Review my draft", description="User question or prompt")
    papers: list[Paper] = Field(default_factory=list)
    projectName: str = "Literature Review"
    projectDescription: str = ""
    modelName: str = Field(default="gemini-2.5-flash", description="Gemini model ID for synthesis and review")
    draftText: str = Field(default="", description="User RRL draft text for review_only intent")
    draft_text: str = Field(default="", description="Snake_case alias for draftText")


# ─── Node output models ─────────────────────────────────────────
class ReviewOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    feedback: str
    approved: bool


# ─── Token usage model ──────────────────────────────────────────
class TokenUsage(BaseModel):
    prompt: int = 0
    completion: int = 0
    total: int = 0


# ─── Final API response model ────────────────────────────────────
class AgentResponse(BaseModel):
    text: Optional[str] = None
    trace: list[str] = Field(default_factory=list)
    review_score: Optional[int] = None
    review_feedback: Optional[str] = None
    criteria_scores: Optional[dict[str, int]] = None
    tokens: TokenUsage = Field(default_factory=TokenUsage)
    latency_ms: int = 0
    retries: int = 0
    used_fallback: bool = False
    model_name: str = "gemini-2.5-flash"
