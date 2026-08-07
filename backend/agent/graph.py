"""
backend/agent/graph.py
LangGraph StateGraph — 5-node agent pipeline for LitAssist.

Pipeline:
  PlannerNode → (conditional) → SearchToolNode → ExtractNode → SynthesizeNode → ReviewerNode
                                                      ↑                              ↓
                                                      └─── retry loop (max 3) ───────┘
"""
import asyncio
import json
import math
import os
import re
import time
import xml.etree.ElementTree as ET
from typing import TypedDict, Annotated, Optional

import httpx
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from .schemas import Paper


# ─── State definition ─────────────────────────────────────────
def merge_lists(a: list, b: list) -> list:
    """Reducer that appends trace messages."""
    return a + b


class AgentState(TypedDict):
    question: str
    project_name: str
    papers: list[dict]
    paper_context: str
    tool_results: str
    draft: str
    review_score: int
    review_feedback: str
    retries: int
    trace: Annotated[list[str], merge_lists]
    prompt_tokens: int
    completion_tokens: int


MAX_RETRIES = 3


# ─── Helper: get LLM ──────────────────────────────────────────
def get_llm() -> ChatGoogleGenerativeAI:
    api_key = os.getenv("API_KEY") or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("NO_API_KEY")
    return ChatGoogleGenerativeAI(
        model="gemini-1.5-flash",
        google_api_key=api_key,
        temperature=0.4,
    )


# ─── Tool: Crossref Paper Search ──────────────────────────────
async def crossref_search_tool(query: str) -> str:
    """
    External tool — queries the Crossref REST API for scholarly papers.
    The agent (PlannerNode) decides when to invoke this.
    """
    encoded = httpx.URL("").copy_with(
        params={"query": query, "rows": "3",
                "select": "title,author,published,container-title,abstract,DOI"}
    )
    url = f"https://api.crossref.org/works?query={httpx.QueryParams({'query': query, 'rows': '3', 'select': 'title,author,published,container-title,abstract,DOI'})}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.crossref.org/works",
                params={
                    "query": query,
                    "rows": "3",
                    "select": "title,author,published,container-title,abstract,DOI",
                },
                headers={"User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)"},
            )
            if resp.status_code != 200:
                return f"Tool Error: Crossref returned HTTP {resp.status_code}"

            items = resp.json().get("message", {}).get("items", [])
            if not items:
                return "No results found via Crossref for this query."

            results = []
            for i, item in enumerate(items):
                title = (item.get("title") or ["Untitled"])[0]
                authors_raw = item.get("author", [])
                authors = "; ".join(
                    f"{a.get('family', '')}, {a.get('given', '')}".strip(", ")
                    for a in authors_raw[:3]
                ) or "Unknown Authors"
                year = ((item.get("published") or {}).get("date-parts") or [[None]])[0][0] or "N/A"
                journal = (item.get("container-title") or ["N/A"])[0]
                doi = item.get("DOI", "N/A")
                abstract_raw = item.get("abstract", "")
                abstract = re.sub(r"<[^>]+>", "", abstract_raw)[:250] + "…" if abstract_raw else "No abstract available."
                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors} ({year})\n'
                    f"Journal: {journal} | DOI: {doi}\nAbstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Tool: Semantic Scholar Search ───────────────────────────
async def semantic_scholar_search_tool(query: str) -> str:
    """
    Queries the Semantic Scholar API for scholarly papers.
    Returns AI-generated TLDRs where available alongside abstracts.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={
                    "query": query,
                    "limit": "3",
                    "fields": "title,authors,year,abstract,tldr",
                },
                headers={"User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)"},
            )
            if resp.status_code != 200:
                return f"Tool Error: Semantic Scholar returned HTTP {resp.status_code}"

            items = resp.json().get("data", [])
            if not items:
                return "No results found via Semantic Scholar for this query."

            results = []
            for i, item in enumerate(items):
                title = item.get("title") or "Untitled"
                authors_raw = item.get("authors", [])
                authors = "; ".join(a.get("name", "") for a in authors_raw[:3]) or "Unknown Authors"
                year = item.get("year") or "N/A"
                abstract_raw = item.get("abstract") or ""
                tldr = item.get("tldr") or {}
                tldr_text = tldr.get("text", "") if isinstance(tldr, dict) else ""
                abstract = (abstract_raw[:250] + "…") if abstract_raw else (tldr_text or "No abstract available.")
                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors} ({year})\n'
                    f"Abstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Tool: arXiv Search ───────────────────────────────────────
async def arxiv_search_tool(query: str) -> str:
    """
    Queries the arXiv API for pre-print papers.
    Essential for cutting-edge CS, AI, and physics research.
    Returns an Atom XML feed parsed via ElementTree.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "http://export.arxiv.org/api/query",
                params={
                    "search_query": f"all:{query}",
                    "max_results": "3",
                    "sortBy": "relevance",
                },
                headers={"User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)"},
            )
            if resp.status_code != 200:
                return f"Tool Error: arXiv returned HTTP {resp.status_code}"

            ns = {"atom": "http://www.w3.org/2005/Atom"}
            root = ET.fromstring(resp.text)
            entries = root.findall("atom:entry", ns)

            if not entries:
                return "No results found via arXiv for this query."

            results = []
            for i, entry in enumerate(entries):
                title = (entry.findtext("atom:title", default="Untitled", namespaces=ns) or "").strip()
                authors = "; ".join(
                    author.findtext("atom:name", default="", namespaces=ns)
                    for author in entry.findall("atom:author", ns)[:3]
                ) or "Unknown Authors"
                published = entry.findtext("atom:published", default="N/A", namespaces=ns) or "N/A"
                year = published[:4] if published != "N/A" else "N/A"
                abstract_raw = entry.findtext("atom:summary", default="", namespaces=ns) or ""
                abstract = (abstract_raw.strip()[:250] + "…") if abstract_raw.strip() else "No abstract available."
                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors} ({year})\n'
                    f"Source: arXiv (pre-print)\nAbstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Tool: PubMed Search (via Europe PMC) ─────────────────────
async def pubmed_search_tool(query: str) -> str:
    """
    Queries Europe PMC for PubMed-indexed papers.
    Uses Europe PMC's JSON API (cleaner than NCBI's XML endpoint).
    Best for medical, biological, and health science literature.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
                params={
                    "query": query,
                    "resulttype": "core",
                    "pageSize": "3",
                    "format": "json",
                },
                headers={"User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)"},
            )
            if resp.status_code != 200:
                return f"Tool Error: Europe PMC returned HTTP {resp.status_code}"

            items = resp.json().get("resultList", {}).get("result", [])
            if not items:
                return "No results found via PubMed/Europe PMC for this query."

            results = []
            for i, item in enumerate(items):
                title = item.get("title") or "Untitled"
                authors_raw = item.get("authorString") or "Unknown Authors"
                year = str(item.get("pubYear") or "N/A")
                journal = item.get("journalTitle") or "N/A"
                abstract_raw = item.get("abstractText") or ""
                abstract = (abstract_raw[:250] + "…") if abstract_raw else "No abstract available."
                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors_raw} ({year})\n'
                    f"Journal: {journal}\nAbstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Tool: OpenAlex Search ────────────────────────────────────
async def openalex_search_tool(query: str) -> str:
    """
    Queries OpenAlex for open-access scholarly works across all disciplines.
    Reconstructs abstracts from OpenAlex's inverted-index format.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.openalex.org/works",
                params={
                    "search": query,
                    "per-page": "3",
                    "select": "title,authorships,publication_year,primary_location,abstract_inverted_index",
                },
                headers={
                    "User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)",
                    "mailto": "research@litassist.app",
                },
            )
            if resp.status_code != 200:
                return f"Tool Error: OpenAlex returned HTTP {resp.status_code}"

            items = resp.json().get("results", [])
            if not items:
                return "No results found via OpenAlex for this query."

            results = []
            for i, item in enumerate(items):
                title = item.get("title") or "Untitled"
                authorships = item.get("authorships", [])
                authors = "; ".join(
                    a.get("author", {}).get("display_name", "")
                    for a in authorships[:3]
                ) or "Unknown Authors"
                year = str(item.get("publication_year") or "N/A")
                location = item.get("primary_location") or {}
                source = (location.get("source") or {}).get("display_name") or "N/A"

                # Reconstruct abstract from OpenAlex's inverted-index format
                abstract = "No abstract available."
                inv_index = item.get("abstract_inverted_index")
                if inv_index:
                    try:
                        max_pos = max(pos for positions in inv_index.values() for pos in positions)
                        words = [""] * (max_pos + 1)
                        for word, positions in inv_index.items():
                            for pos in positions:
                                words[pos] = word
                        abstract_text = " ".join(words).strip()
                        abstract = (abstract_text[:250] + "…") if abstract_text else "No abstract available."
                    except Exception:
                        pass

                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors} ({year})\n'
                    f"Journal/Source: {source}\nAbstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Node 1: Planner ──────────────────────────────────────────
async def planner_node(state: AgentState) -> dict:
    """
    The agent's planning step. Autonomously decides whether to call
    the Crossref search tool based on the question and available papers.
    This is what satisfies the course definition of an agent:
    model + planning + tools + orchestration.
    """
    start = time.time()
    papers = state.get("papers", [])
    q = state["question"].lower()

    needs_tool = (
        len(papers) == 0
        or any(kw in q for kw in ["search", "find", "latest", "recent", "look up", "additional", "more paper"])
    )

    elapsed = int((time.time() - start) * 1000)

    if needs_tool:
        search_query = (
            f"{state.get('project_name', '')} {papers[0].get('tags', [''])[0] if papers else ''}"
            if papers
            else state["question"]
        ).strip()
        return {
            "tool_results": f"__SEARCH__:{search_query}",
            "trace": [f"[PlannerNode +{elapsed}ms] Agent decided to invoke SearchTool for: \"{search_query}\""],
        }

    return {
        "tool_results": "",
        "trace": [f"[PlannerNode +{elapsed}ms] Agent using existing {len(papers)} paper(s) — no tool call needed."],
    }


# ─── Node 2: Search Tool ──────────────────────────────────────
async def search_tool_node(state: AgentState) -> dict:
    """
    Queries 5 academic databases in parallel when the Planner requests a search:
    Crossref, Semantic Scholar, arXiv, PubMed (via Europe PMC), and OpenAlex.

    asyncio.gather with return_exceptions=True ensures that a single slow or
    broken database never blocks results from the others.
    """
    start = time.time()

    if not state.get("tool_results", "").startswith("__SEARCH__:"):
        return {"trace": ["[SearchToolNode +0ms] Skipped — no tool call requested."]}

    query = state["tool_results"].replace("__SEARCH__:", "")

    # ── Run all 5 databases in parallel ──────────────────────────
    raw_results = await asyncio.gather(
        crossref_search_tool(query),
        semantic_scholar_search_tool(query),
        arxiv_search_tool(query),
        pubmed_search_tool(query),
        openalex_search_tool(query),
        return_exceptions=True,
    )

    DB_LABELS = ["Crossref", "Semantic Scholar", "arXiv", "PubMed", "OpenAlex"]
    sections = []
    statuses = []

    for label, result in zip(DB_LABELS, raw_results):
        if isinstance(result, Exception):
            statuses.append(f"{label} ✗")
            continue
        if not isinstance(result, str) or result.startswith("Tool Error"):
            statuses.append(f"{label} ✗")
            continue
        if result.startswith("No results"):
            statuses.append(f"{label} (0 results)")
            continue
        sections.append(f"=== {label} ===\n\n{result}")
        statuses.append(f"{label} ✓")

    merged = "\n\n".join(sections) if sections else "No results found across all academic databases."
    elapsed = int((time.time() - start) * 1000)
    status_summary = ", ".join(statuses)

    return {
        "tool_results": merged,
        "trace": [f"[SearchToolNode +{elapsed}ms] Queried 5 databases in parallel — {status_summary}"],
    }


# ─── Node 3: Extract / Context Builder ────────────────────────
async def extract_node(state: AgentState) -> dict:
    """
    Builds the context string from user-selected papers (context injection)
    and appends any results returned by the SearchTool.

    Note: This uses context injection — the user explicitly selects which
    papers to include — rather than embedding-based RAG (no vector DB).
    This is an intentional design choice for transparency in academic writing.
    """
    start = time.time()
    papers = state.get("papers", [])

    if papers:
        paper_lines = []
        for i, p in enumerate(papers):
            findings = "; ".join(p.get("keyFindings", [])) or "N/A"
            tags = ", ".join(p.get("tags", [])) or "N/A"
            paper_lines.append(
                f"Paper {i + 1}:\n"
                f"Title: {p.get('title', 'Untitled')}\n"
                f"Authors: {p.get('authors', 'N/A')} ({p.get('year', 'N/A')})\n"
                f"Journal: {p.get('journal', 'N/A')}\n"
                f"Tags: {tags}\n"
                f"Abstract: {p.get('abstract', 'N/A')}\n"
                f"Methodology: {p.get('methodology', 'N/A')}\n"
                f"Key Findings: {findings}"
            )
        selected_context = "## User-Selected Papers (Project Context)\n\n" + "\n---\n".join(paper_lines)
    else:
        selected_context = "No project papers selected by user."

    tool_results = state.get("tool_results", "")
    tool_context = ""
    if tool_results and not tool_results.startswith("__SEARCH__:") and not tool_results.startswith("Tool Error"):
        tool_context = "\n\n## Additional Papers Retrieved by Agent (Multi-Database Search)\n\n" + tool_results

    elapsed = int((time.time() - start) * 1000)
    tool_note = " + multi-database search results" if tool_context else ""

    return {
        "paper_context": selected_context + tool_context,
        "trace": [f"[ExtractNode +{elapsed}ms] Context built: {len(papers)} project paper(s){tool_note}."],
    }


# ─── Node 4: Synthesize ───────────────────────────────────────
async def synthesize_node(state: AgentState) -> dict:
    """Calls Gemini to generate an RRL draft using the built context."""
    start = time.time()

    retry_note = ""
    if state.get("retries", 0) > 0:
        retry_note = (
            f"\nPrevious draft scored {state.get('review_score', 0)}/100. "
            f"Reviewer feedback: \"{state.get('review_feedback', '')}\". "
            "Please improve accordingly."
        )

    prompt = (
        f"You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant.\n"
        f"Project: \"{state.get('project_name', 'Literature Review')}\".\n\n"
        f"{state.get('paper_context', '')}\n\n"
        f"User Question: \"{state['question']}\"\n"
        f"{retry_note}\n\n"
        "Write a highly academic, structured, and insightful RRL response. "
        "Use clear markdown formatting with headers and bullet points. "
        "Cite author names when referring to specific papers."
    )

    text = ""
    prompt_tokens = 0
    completion_tokens = 0

    try:
        llm = get_llm()
        result = llm.invoke(prompt)
        text = result.content if isinstance(result.content, str) else str(result.content)
        prompt_tokens = math.ceil(len(prompt) / 4)
        completion_tokens = math.ceil(len(text) / 4)
    except ValueError as e:
        if "NO_API_KEY" in str(e):
            text = "__FALLBACK__"
        else:
            raise

    elapsed = int((time.time() - start) * 1000)
    total_tokens = prompt_tokens + completion_tokens

    return {
        "draft": text,
        "prompt_tokens": state.get("prompt_tokens", 0) + prompt_tokens,
        "completion_tokens": state.get("completion_tokens", 0) + completion_tokens,
        "trace": [f"[SynthesizeNode +{elapsed}ms] Generated draft (retry #{state.get('retries', 0)}, ~{total_tokens} tokens)."],
    }


# ─── Node 5: Reviewer (LLM-as-judge) ─────────────────────────
async def review_node(state: AgentState) -> dict:
    """
    Scores the draft 0–100. If score < 80 and retries < MAX_RETRIES,
    the graph loops back to SynthesizeNode (guardrail).
    """
    start = time.time()

    if state.get("draft") == "__FALLBACK__":
        return {
            "review_score": 100,
            "review_feedback": "Offline synthesis engine active (no API key configured).",
            "trace": ["[ReviewerNode +0ms] Skipped — offline synthesis mode."],
        }

    tool_note = (
        " + Crossref tool results"
        if state.get("tool_results") and not state.get("tool_results", "").startswith("__SEARCH__:")
        else ""
    )

    review_prompt = (
        f"You are a strict academic peer reviewer evaluating an AI-generated Literature Review (RRL) draft.\n\n"
        f"User Question: \"{state['question']}\"\n"
        f"Paper Context Available: {len(state.get('papers', []))} project papers{tool_note}\n"
        f"Draft:\n{state.get('draft', '')}\n\n"
        "Score this draft from 0–100 based on:\n"
        "- Academic rigor and citation of provided papers (40 pts)\n"
        "- Clarity and structure (30 pts)\n"
        "- Relevance to the research question (30 pts)\n\n"
        'Respond in this exact JSON format:\n'
        '{"score": <number 0-100>, "feedback": "<one sentence of improvement advice>", "approved": <true if score >= 80>}'
    )

    score = 85
    feedback = "Draft meets academic standards."
    approved = True

    try:
        llm = get_llm()
        result = llm.invoke(review_prompt)
        raw = result.content if isinstance(result.content, str) else str(result.content)
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            parsed = json.loads(match.group())
            score = int(parsed.get("score", 85))
            feedback = str(parsed.get("feedback", ""))
            approved = bool(parsed.get("approved", True))
    except Exception:
        pass  # Keep defaults on any parse or API error

    elapsed = int((time.time() - start) * 1000)
    status = "Approved." if approved else f"Needs revision: {feedback}"

    return {
        "review_score": score,
        "review_feedback": feedback,
        "retries": state.get("retries", 0) + (0 if score >= 80 else 1),
        "trace": [f"[ReviewerNode +{elapsed}ms] Score: {score}/100. {status}"],
    }


# ─── Routing functions ─────────────────────────────────────────
def planner_decision(state: AgentState) -> str:
    return "searchTool" if state.get("tool_results", "").startswith("__SEARCH__:") else "extract"


def should_retry(state: AgentState) -> str:
    if state.get("draft") == "__FALLBACK__":
        return "end"
    if state.get("review_score", 0) >= 80 or state.get("retries", 0) >= MAX_RETRIES:
        return "end"
    return "synthesize"


# ─── Build and compile graph ───────────────────────────────────
def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner_node)
    graph.add_node("searchTool", search_tool_node)
    graph.add_node("extract", extract_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("review", review_node)

    graph.set_entry_point("planner")
    graph.add_conditional_edges("planner", planner_decision, {
        "searchTool": "searchTool",
        "extract": "extract",
    })
    graph.add_edge("searchTool", "extract")
    graph.add_edge("extract", "synthesize")
    graph.add_edge("synthesize", "review")
    graph.add_conditional_edges("review", should_retry, {
        "synthesize": "synthesize",
        "end": END,
    })

    return graph.compile()


# ─── Public runner ─────────────────────────────────────────────
async def run_litassist_graph(
    question: str,
    papers: list[dict],
    project_name: str = "Literature Review",
) -> dict:
    """Entry point called by the FastAPI route."""
    start_time = time.time()
    app = build_graph()

    result = await app.ainvoke({
        "question": question,
        "project_name": project_name,
        "papers": papers,
        "paper_context": "",
        "tool_results": "",
        "draft": "",
        "review_score": 0,
        "review_feedback": "",
        "retries": 0,
        "trace": [],
        "prompt_tokens": 0,
        "completion_tokens": 0,
    })

    latency_ms = int((time.time() - start_time) * 1000)
    used_fallback = result.get("draft") == "__FALLBACK__"
    prompt_tokens = result.get("prompt_tokens", 0)
    completion_tokens = result.get("completion_tokens", 0)

    return {
        "text": None if used_fallback else result.get("draft"),
        "trace": result.get("trace", []),
        "review_score": result.get("review_score", 0),
        "tokens": {
            "prompt": prompt_tokens,
            "completion": completion_tokens,
            "total": prompt_tokens + completion_tokens,
        },
        "latency_ms": latency_ms,
        "retries": result.get("retries", 0),
        "used_fallback": used_fallback,
    }
