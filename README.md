# LitAssist
> **An Intelligent RRL Analysis & AI Research Assistant**

LitAssist is an AI-powered web application designed to assist academic researchers, thesis students, and scholars in analyzing, synthesizing, and drafting **Reviews of Related Literature (RRL)**. It uses a 5-node LangGraph agent pipeline for AI-assisted synthesis, parallel multi-database paper discovery, LLM-as-judge quality control, and full in-app observability.

---

## Architecture Overview

```
┌─────────────────────────────────────┐     HTTP (port 3000)
│   Next.js Frontend (React)          │◄──────────────────── Browser
│   - UI panels, chat, compare        │
│   - Model selector (3 Gemini opts)  │
│   - /api/chat → thin proxy          │
└────────────┬────────────────────────┘
             │ POST http://localhost:8000/chat
             ▼
┌─────────────────────────────────────┐
│   Python Backend (FastAPI)          │
│   - LangGraph 5-node pipeline       │
│   - 5 academic databases (parallel) │
│   - Gemini 1.5 Flash / 2.0 Flash /  │
│     1.5 Pro via langchain-google-   │
│     genai (user-selectable)         │
└─────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI & Logic**: React 19, TypeScript
- **Styling**: Vanilla CSS Modules, Google Fonts (*Fraunces*, *DM Sans*, *DM Mono*)
- **Icons**: Lucide React

### Backend (Python)
- **API Server**: [FastAPI](https://fastapi.tiangolo.com/) + Uvicorn
- **Agent Framework**: [LangGraph](https://langchain-ai.github.io/langgraph/) (Python)
- **LLM**: Google Gemini via [`langchain-google-genai`](https://pypi.org/project/langchain-google-genai/) — user-selectable model:
  - `gemini-1.5-flash` *(default, fastest)*
  - `gemini-2.0-flash` *(latest generation)*
  - `gemini-1.5-pro` *(deepest reasoning, 2M token context)*
- **Input Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **HTTP Client**: [httpx](https://www.python-httpx.org/) (async)
- **Academic Search APIs** *(all free, no API keys required)*:
  - [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
  - [Semantic Scholar Graph API](https://api.semanticscholar.org/graph/v1)
  - [arXiv API](https://info.arxiv.org/help/api/)
  - [Europe PMC REST API](https://europepmc.org/RestfulWebService) *(PubMed-indexed papers)*
  - [OpenAlex API](https://docs.openalex.org/)

---

## Agent Pipeline

LitAssist uses a **LangGraph `StateGraph`** with 5 nodes that autonomously plans, calls external tools, generates, and self-reviews its RRL responses.

```
[PlannerNode]     → Agent decides: invoke SearchTool or use existing papers?
      ↓ (needs search)               ↓ (papers already available)
[SearchToolNode]                 [ExtractNode]
  queries 5 databases  ──────────────►↑
  in parallel (asyncio.gather)
  Crossref · Semantic Scholar · arXiv · PubMed · OpenAlex
[ExtractNode]     → Builds context: project papers + multi-database results
[SynthesizeNode]  → Calls user-selected Gemini model to draft RRL response
[ReviewerNode]    → LLM-as-judge scores draft 0–100
      ↓ score < 80 AND retries < 3  →  loops back to SynthesizeNode
      ↓ score ≥ 80 OR max retries   →  returns final answer
```

### Design Notes
- **Context Injection, not Embedding RAG**: The `ExtractNode` formats user-selected papers and tool results directly into the prompt. Users explicitly choose which papers to analyze — an intentional choice for transparency in academic writing (no vector DB required).
- **Real Tool Use**: The `PlannerNode` autonomously decides when to invoke the multi-database search, satisfying the agent definition: *model + planning + tools + orchestration*.
- **Parallel Search**: All 5 academic databases are queried simultaneously via `asyncio.gather(return_exceptions=True)` — a single slow or unavailable database never blocks the others.
- **User-Selectable Model**: The `model_name` field flows from the UI dropdown through the API chain into `AgentState`, so both `SynthesizeNode` and `ReviewerNode` use the same user-chosen Gemini model.

---

## Observability

Every agent response exposes the following signals in the chat UI:

| Signal | Source | UI Location |
|---|---|---|
| **Node trace log** | Each node appends `[NodeName +Nms] ...` to `AgentState.trace` | Expandable "Trace" toggle per message |
| **Model used** | `model_name` from `AgentState` | Small badge (e.g. `1.5-flash`) next to "LitAssist AI" |
| **Review score (0–100)** | `ReviewerNode` LLM-as-judge | Score badge per message |
| **Token usage** | `SynthesizeNode` estimates prompt + completion tokens | Token count in message actions |
| **End-to-end latency** | Wall-clock ms from `run_litassist_graph()` | Latency display in message actions |
| **Retry count** | `retries` field in `AgentState` | Retry badge if > 0 |

### Capstone Rubric Coverage

| Requirement | Must-Have | Stretch Goal |
|---|---|---|
| Framework | Python LangGraph `StateGraph` (5 nodes) | Planner node with autonomous tool decision |
| Guardrails | Max 3 retries + Pydantic v2 input validation | ReviewerNode LLM-as-judge scoring |
| Observability | Per-node trace log with ms timing | Token count + latency + model badge in UI |
| Cost & Quality | Tokens + latency returned per message | Review score badge + user-selectable model |

---

## Features

- **Multi-Database Academic Search** — `SearchToolNode` queries Crossref, Semantic Scholar, arXiv, PubMed (via Europe PMC), and OpenAlex simultaneously via `asyncio.gather`
- **AI Model Selector** — Switch between Gemini 1.5 Flash, Gemini 2.0 Flash, and Gemini 1.5 Pro from the chat panel; the selected model is displayed on every response
- **LangGraph AI Chatbot** — 5-node Python agent pipeline with per-node trace log, token metrics, review score badge, model badge, and retry count
- **DOI / Title Metadata Search** — Fetch paper metadata via Crossref API (also used as agent search tool)
- **PDF & Document Upload** — Drag & drop `.pdf`, `.txt`, `.md` files to auto-extract abstracts and findings
- **Paper Comparison Matrix** — Compare up to 4 selected papers across 6 RRL dimensions
- **Offline Fallback** — Built-in rule-based synthesis engine when the Python backend is unreachable
- **Light & Dark Mode** — Theme toggle with local storage persistence
- **Project & Chat History** — Persistent multi-project organization with named chat sessions

---

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

---

## Project Structure

```
LitAssist/
├── backend/                      # Python FastAPI + LangGraph backend
│   ├── main.py                   # FastAPI app, POST /chat endpoint
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # API key template
│   └── agent/
│       ├── graph.py              # LangGraph StateGraph (5 nodes + 5 search tools)
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
│   ├── RightPanel/               # AI chat with model selector, observability UI
│   └── AnalyzeSummarizeView/     # RRL analysis and summarize view
└── types/
    └── index.ts                  # Shared TypeScript types
```

---

## License

Distributed under the ISC License.