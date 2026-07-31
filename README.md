# LitAssist
> **An Intelligent RRL Analysis & AI Research Assistant**

LitAssist is an AI-powered web application designed to assist academic researchers, thesis students, and scholars in analyzing, synthesizing, and drafting **Reviews of Related Literature (RRL)**. It uses a multi-agent LangGraph pipeline for AI-assisted synthesis, real-time paper comparison, DOI metadata search, and PDF document parsing.

## Architecture Overview

```
┌─────────────────────────────────┐     HTTP (port 3000)
│   Next.js Frontend (React)      │◄──────────────────── Browser
│   - UI panels, chat, compare    │
│   - /api/chat → thin proxy      │
└────────────┬────────────────────┘
             │ POST http://localhost:8000/chat
             ▼
┌─────────────────────────────────┐
│   Python Backend (FastAPI)      │
│   - LangGraph 5-node pipeline   │
│   - Crossref tool integration   │
│   - Gemini 1.5 Flash via        │
│     langchain-google-genai      │
└─────────────────────────────────┘
```

## Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI & Logic**: React 19, TypeScript
- **Styling**: Vanilla CSS Modules, Google Fonts (*Fraunces*, *DM Sans*, *DM Mono*)
- **Icons**: Lucide React

### Backend (Python)
- **API Server**: [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn
- **Agent Framework**: [LangGraph](https://langchain-ai.github.io/langgraph/) (Python)
- **LLM**: Google Gemini 1.5 Flash via [`langchain-google-genai`](https://pypi.org/project/langchain-google-genai/)
- **Input Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **HTTP Client**: [httpx](https://www.python-httpx.org/)
- **External APIs**: [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/), Google Gemini API

## Agent Pipeline

LitAssist uses a **LangGraph `StateGraph`** with 5 nodes that autonomously plans, calls external tools, generates, and self-reviews its RRL responses.

```
[PlannerNode]     → Agent decides: invoke SearchTool or use existing papers?
      ↓ (needs search)             ↓ (papers already available)
[SearchToolNode]               [ExtractNode]
  calls Crossref API  ─────────────►↑
  returns up to 3 results
[ExtractNode]     → Builds context: project papers + tool results
[SynthesizeNode]  → Calls Gemini 1.5 Flash to draft RRL response
[ReviewerNode]    → LLM-as-judge scores draft 0–100
      ↓ score < 80 AND retries < 3  →  loops back to SynthesizeNode
      ↓ score ≥ 80 OR max retries   →  returns final answer
```

### Design Notes
- **Context Injection, not Embedding RAG**: The `ExtractNode` formats user-selected papers and Crossref tool results into the prompt. Users explicitly choose which papers to analyze — an intentional choice for transparency in academic writing (no vector DB required).
- **Real Tool Use**: The `PlannerNode` autonomously decides when to call the Crossref API, satisfying the course definition of an agent: *model + planning + tools + orchestration*.

### Capstone Rubric Coverage

| Requirement | Must-Have | Stretch Goal |
|---|---|---|
| Framework | Python LangGraph `StateGraph` (5 nodes) | Planner node with autonomous tool decision |
| Guardrails | Max 3 retries + Pydantic v2 input validation | ReviewerNode LLM-as-judge scoring |
| Observability | Per-node trace log with ms timing | Token count + latency per run in UI |
| Cost & Quality | Tokens + latency returned per message | Review score badge in chat UI |

## Features

- **DOI / Title Metadata Search** — Fetch paper metadata via Crossref API (also used as agent tool)
- **PDF & Document Upload** — Drag & drop `.pdf`, `.txt`, `.md` files to auto-extract abstracts and findings
- **Paper Comparison Matrix** — Compare up to 4 selected papers across 6 RRL dimensions
- **LangGraph AI Chatbot** — 5-node Python agent pipeline with per-node trace log, token metrics, review score badge, and retry count
- **Light & Dark Mode** — Theme toggle with local storage persistence
- **Project & Chat History** — Persistent multi-project organization with named chat sessions

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ChrystelAnneMarcelo/LitAssist.git
   cd LitAssist
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Install Python backend dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Configure your Gemini API key** *(optional — app works offline without it)*:
   ```bash
   # In /backend/.env  (copy from .env.example)
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   > Without an API key, LitAssist falls back to its built-in offline RRL synthesis engine.

### Running Locally

**Terminal 1 — Python backend:**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Next.js frontend:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploying to Production

When deploying, set `PYTHON_BACKEND_URL` in your Next.js environment:
```env
# .env.local (Next.js)
PYTHON_BACKEND_URL=https://your-deployed-backend.com
```
The `/api/chat` proxy route will automatically forward to this URL.

## Project Structure

```
LitAssist/
├── backend/                      # Python FastAPI + LangGraph backend
│   ├── main.py                   # FastAPI app, POST /chat endpoint
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # API key template
│   └── agent/
│       ├── graph.py              # LangGraph StateGraph (5 nodes)
│       └── schemas.py            # Pydantic v2 input/output models
│
├── app/
│   ├── api/chat/route.ts         # Next.js proxy → Python backend
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── AppShell/                 # Root layout and global state
│   ├── LeftSidebar/              # Project and chat session navigation
│   ├── FileListView/             # Paper list, compare matrix, DOI search, detail modals
│   ├── RightPanel/               # AI chat with observability UI (trace/tokens/score)
│   └── AnalyzeSummarizeView/     # RRL analysis and summarize view
└── types/
    └── index.ts                  # Shared TypeScript types
```

## License

Distributed under the ISC License.