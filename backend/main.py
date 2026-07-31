"""
backend/main.py
FastAPI application for LitAssist Python backend.
Exposes POST /chat which runs the LangGraph agent pipeline.
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from agent.schemas import ChatInput, AgentResponse, TokenUsage
from agent.graph import run_litassist_graph

# Load .env file (GEMINI_API_KEY)
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("✅ LitAssist Python backend starting…")
    print(f"   API key configured: {'Yes' if os.getenv('GEMINI_API_KEY') or os.getenv('API_KEY') else 'No (offline mode)'}")
    yield
    print("⛔ LitAssist Python backend shutting down.")


app = FastAPI(
    title="LitAssist Agent API",
    description="Python FastAPI + LangGraph backend for LitAssist RRL assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow requests from the Next.js frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health_check():
    return {"status": "ok", "service": "LitAssist Agent API"}


@app.post("/chat", response_model=AgentResponse)
async def chat(body: ChatInput):
    """
    Run the LangGraph multi-agent pipeline:
      PlannerNode → (optional) SearchToolNode → ExtractNode → SynthesizeNode → ReviewerNode

    Returns the generated text along with full observability data:
    trace logs, token usage, review score, latency, and retry count.
    """
    try:
        result = await run_litassist_graph(
            question=body.question,
            papers=[p.model_dump() for p in body.papers],
            project_name=body.projectName,
        )

        return AgentResponse(
            text=result["text"],
            trace=result["trace"],
            review_score=result["review_score"],
            tokens=TokenUsage(
                prompt=result["tokens"]["prompt"],
                completion=result["tokens"]["completion"],
                total=result["tokens"]["total"],
            ),
            latency_ms=result["latency_ms"],
            retries=result["retries"],
            used_fallback=result["used_fallback"],
        )

    except Exception as e:
        print(f"[ERROR] LangGraph agent failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
