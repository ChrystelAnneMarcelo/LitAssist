# LitAssist
> **An Intelligent RRL Analysis & AI Research Assistant**

LitAssist is an AI-powered web application designed to assist academic researchers, thesis students, and scholars in analyzing, synthesizing, and drafting **Reviews of Related Literature (RRL)**. It uses a multi-agent LangGraph pipeline for AI-assisted synthesis, real-time paper comparison, DOI metadata search, and PDF document parsing.

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
- **UI & Logic**: React 19, TypeScript
- **Styling**: Vanilla CSS Modules, Google Fonts (*Fraunces*, *DM Sans*, *DM Mono*)
- **Icons**: Lucide React
- **Agent Framework**: [LangGraph JS/TS](https://langchain-ai.github.io/langgraphjs/) (`@langchain/langgraph`)
- **LLM**: Google Gemini 1.5 Flash (`@langchain/google-genai`)
- **Input Validation**: [Zod](https://zod.dev/)
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
- **Context Injection, not Embedding RAG**: Users explicitly select which papers to include — formatted into the prompt for transparency in academic writing.
- **Real Tool Use**: The `PlannerNode` autonomously decides when to call the Crossref API, satisfying the course definition of an agent: *model + planning + tools + orchestration*.

## Features

- **DOI / Title Metadata Search**: Fetch paper metadata via Crossref Academic API (also used as agent search tool)
- **PDF & Document Upload**: Drag & drop `.pdf`, `.txt`, `.md` files to auto-extract abstracts and findings
- **Paper Comparison Matrix**: Compare up to 4 selected papers across 6 RRL dimensions (Research Objective, Methodology, Sample/Dataset, Key Findings, Limitations, Relevance)
- **LangGraph AI Chatbot**: 5-node agent pipeline with per-node trace log, token metrics, review score badge, and retry count visible in the chat UI
- **Light & Dark Mode**: Theme toggle with local storage persistence
- **Project & Chat History**: Persistent multi-project organization with named chat sessions

## Getting Started

### Prerequisites
- Node.js 18+

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ChrystelAnneMarcelo/LitAssist.git
   cd LitAssist
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your Gemini API key** *(optional — app works offline without it)*:

   Create a `.env.local` file in the project root:
   ```env
   # Get a free Gemini API key at https://aistudio.google.com/
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   > Without an API key, LitAssist automatically falls back to its built-in offline RRL synthesis engine.

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
LitAssist/
├── app/
│   ├── api/chat/route.ts         # LangGraph agent API (Zod validation + 5-node pipeline)
│   ├── page.tsx
│   └── layout.tsx
├── lib/
│   └── agent/
│       ├── graph.ts              # LangGraph StateGraph (Planner → SearchTool → Extract → Synthesize → Review)
│       └── schemas.ts            # Zod input/output validation schemas
├── components/
│   ├── AppShell/                 # Root layout and global state management
│   ├── LeftSidebar/              # Project and chat session navigation
│   ├── FileListView/             # Paper list, compare matrix, DOI search, paper detail modals
│   ├── RightPanel/               # AI chat with observability UI (trace/tokens/score)
│   └── AnalyzeSummarizeView/     # RRL analysis and summarize view
└── types/
    └── index.ts                  # Shared TypeScript types
```

## License

Distributed under the ISC License.
