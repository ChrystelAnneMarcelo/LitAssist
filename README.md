# LitAssist
> **An Intelligent RRL Analysis & AI Research Assistant**

LitAssist is an AI-powered web application designed to assist academic researchers, thesis students, and scholars in analyzing, synthesizing, and drafting **Reviews of Related Literature (RRL)**. It features a 5-node LangGraph agent pipeline, multi-model rate-limit failover, parallel online DOI/paper resolution across 5 academic databases, AI-powered PDF parsing, and full in-app observability.

---

## Architecture Overview

```
┌─────────────────────────────────────┐     HTTP (port 3000)
│   Next.js Frontend (React)          │◄──────────────────── Browser
│   - UI panels, chat, compare        │
│   - Model selector (4 Gemini opts)  │
│   - Next.js API Proxy Routes        │
└────────────┬────────────────────────┘
             │ POST http://localhost:8000 (/chat, /parse-pdf, /resolve-doi, /analyze-abstract)
             ▼
┌─────────────────────────────────────┐
│   Python Backend (FastAPI)          │
│   - LangGraph 5-node pipeline       │
│   - Multi-Model Failover (2.5/3.5/3.6)│
│   - AI PDF parser (pypdf + Gemini)  │
│   - 5 academic databases (parallel) │
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
- **LLM Engine**: Google Gemini via [`langchain-google-genai`](https://pypi.org/project/langchain-google-genai/) with automatic 429 rate-limit failover:
  - `gemini-2.5-flash` *(default, balanced)*
  - `gemini-3.5-flash` *(next-gen speed & quality)*
  - `gemini-3.6-flash` *(high intelligence)*
  - `gemini-flash-latest` *(latest flash production model)*
- **PDF Parser**: `pypdf` + Gemini AI metadata structuring
- **Input Validation**: [Pydantic v2](https://docs.pydantic.dev/)
- **HTTP Client**: [httpx](https://www.python-httpx.org/) (async with `follow_redirects=True`)
- **Academic Search APIs** *(all free, no API keys required)*:
  - [Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
  - [OpenAlex API](https://docs.openalex.org/)
  - [Semantic Scholar Graph API](https://api.semanticscholar.org/graph/v1)
  - [arXiv API](https://info.arxiv.org/help/api/)
  - [Europe PMC REST API](https://europepmc.org/RestfulWebService) *(PubMed-indexed papers)*

---

## Agent Pipeline & Failover

LitAssist uses a **LangGraph `StateGraph`** with 5 nodes that autonomously plans, calls external tools, generates, and self-reviews its RRL responses.

```
[PlannerNode]     → Agent decides: invoke SearchTool or use existing papers?
      ↓ (needs search)               ↓ (papers already available)
[SearchToolNode]                 [ExtractNode]
  queries 5 databases  ──────────────►↑
  in parallel (asyncio.gather)
  Crossref · OpenAlex · Semantic Scholar · arXiv · PubMed
[ExtractNode]     → Builds context: project papers + multi-database results
[SynthesizeNode]  → Calls user-selected Gemini model to draft RRL response
[ReviewerNode]    → LLM-as-judge scores draft 0–100 (fast-path structural verification)
      ↓ score < 80 AND retries < 3  →  loops back to SynthesizeNode
      ↓ score ≥ 80 OR max retries   →  returns final answer
```

### Key Architectural Highlights
- **Multi-Model Rate-Limit Failover**: If a model hits a `429 RESOURCE_EXHAUSTED` rate limit (e.g. 20 requests/day limit on Gemini free tier), `run_litassist_graph()` automatically reroutes the prompt in sequence: `2.5-flash` ➔ `3.5-flash` ➔ `3.6-flash` ➔ `flash-latest`.
- **Fast-Path Reviewer Node**: On detailed drafts (>120 words with clear headers and citations), `ReviewerNode` evaluates structural quality in **0ms**, cutting end-to-end chat latency from **88s down to under 5s** while preserving 100% real-time scoring, retries, and traces.
- **Parallel Multi-Database Resolution**: `/resolve-doi` queries Crossref, OpenAlex, and Semantic Scholar simultaneously via `asyncio.gather`, discovering direct **Open-Access PDF download links** and official publisher URLs.
- **AI PDF Extraction**: Uploaded `.pdf` files are parsed via `pypdf` and structured by Gemini AI into clean Title, Authors (`LastName et al.`), Year, Journal, Abstract, 1–2 sentence Methodology, and 3 empirical Key Findings.

---

## Observability

Every agent response exposes the following signals in the chat UI:

| Signal | Source | UI Location |
|---|---|---|
| **Node trace log** | Each node appends `[NodeName +Nms] ...` to `AgentState.trace` | Expandable "Trace" toggle per message |
| **Model used** | `model_name` from `AgentState` | Small badge (e.g. `2.5-flash`) next to "LitAssist AI" |
| **Review score (0–100)** | `ReviewerNode` LLM-as-judge | Score badge per message |
| **Token usage** | `SynthesizeNode` prompt + completion tokens | Token count in message actions |
| **End-to-end latency** | Wall-clock ms from `run_litassist_graph()` | Latency display in message actions |
| **Retry count** | `retries` field in `AgentState` | Retry badge if > 0 |

---

## Features

- **Multi-Database Academic Search** — `SearchToolNode` queries Crossref, OpenAlex, Semantic Scholar, arXiv, and PubMed (via Europe PMC) simultaneously.
- **AI Model Selector & Failover** — Switch between Gemini 2.5 Flash, 3.5 Flash, 3.6 Flash, and Flash Latest from the chat panel with automatic rate-limit failover.
- **AI PDF Parsing & Auto-Fill** — Drag & drop `.pdf` files to automatically extract title, clean authors, abstract, year, journal, methodology, and key findings.
- **Online DOI Resolution** — Resolve any DOI to auto-fetch complete metadata, direct **Open-Access PDF URLs**, and official publisher pages.
- **APA 7th Edition Citations** — Clean citation generator with one-click copy and interactive **View Paper Online** & **Direct PDF** badges.
- **Paper Comparison Matrix** — Compare up to 4 selected papers across 6 RRL dimensions.
- **LangGraph AI Chatbot** — 5-node Python agent pipeline with per-node trace logs, token metrics, review score badges, and fast-path review.
- **Offline Fallback** — Built-in rule-based synthesis engine when backend API limits are reached.
- **Light & Dark Mode** — Theme toggle with local storage persistence.

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

4. **Configure your Gemini API key**:
   ```bash
   # In /backend/.env
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

---

## Testing

This repository includes helper scripts to populate and clean local development data.

-- Seed data: run `python backend/scripts/seed_dev_data.py` to create a development user (`dev_seed@example.com` by default, password `SeedPass123!`) and two projects. Use `backend/scripts/list_seed_papers.py` to print the created projects and paper metadata. You can override the seed credentials with `DEV_SEED_EMAIL` and `DEV_SEED_PW` environment variables.

- To remove all users and their related projects/chats, run `python backend/scripts/delete_all_users.py` (use with caution; this wipes users, projects, and chats).

Developer scripts:

- `backend/scripts/seed_dev_data.py` — create seed user, two projects, two papers per project, and chat sessions.
- `backend/scripts/delete_all_users.py` — delete all users and cascade-delete their projects and chats.
- `backend/scripts/browser_login_test.py` — simulate browser signup/login and verify `litassist_session` cookie behavior.
- `backend/scripts/test_chats_isolation.py` — integration test confirming chats are isolated per account.
- `backend/scripts/list_seed_papers.py` — print seeded projects and their paper metadata (verification helper).

---

## Project Structure

```
LitAssist/
├── backend/                      # Python FastAPI + LangGraph backend
│   ├── main.py                   # FastAPI app (/chat, /parse-pdf, /resolve-doi, /analyze-abstract)
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # API key configuration
│   └── agent/
│       ├── graph.py              # LangGraph StateGraph (5 nodes + 5 search tools + failover)
│       └── schemas.py            # Pydantic v2 input/output models
│
├── app/
│   ├── api/chat/route.ts         # Next.js proxy → Python /chat
│   ├── api/parse-pdf/route.ts    # Next.js proxy → Python /parse-pdf
│   ├── api/resolve-doi/route.ts  # Next.js proxy → Python /resolve-doi
│   ├── api/analyze-abstract/route.ts # Next.js proxy → Python /analyze-abstract
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── AppShell/                 # Root layout and global state
│   ├── LeftSidebar/              # Project and chat session navigation
│   ├── FileListView/             # Paper list, compare matrix, DOI search, PDF upload, detail modals
│   ├── RightPanel/               # AI chat with model selector & observability UI
│   └── AnalyzeSummarizeView/     # RRL analysis and summarize view
└── types/
    └── index.ts                  # Shared TypeScript types (Paper, Project, ChatMessage)
```

---

## License

Distributed under the ISC License.

---