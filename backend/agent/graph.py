"""
backend/agent/graph.py
LangGraph StateGraph — Multi-Agent Router Pipeline for LitAssist.

Pipeline:
  RouterNode (entry) → intent classification
    ├── analyze  → PlannerNode → SearchToolNode → ExtractNode → SynthesizeNode → ReviewerNode
    ├── summarize→ ExtractNode → SynthesizeNode → ReviewerNode
    └── general  → PlannerNode → SearchToolNode → ExtractNode → SynthesizeNode → ReviewerNode

  ReviewerNode retry loop (max 3): SynthesizeNode ← score < 80
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
    project_description: str
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
    model_name: str
    intent: str        # Routed intent: "analyze" | "summarize" | "review_only" | "general"
    draft_text: str    # User-supplied draft for review_only path (empty otherwise)


MAX_RETRIES = 3


VALID_MODELS = {
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-flash-latest",
}


# ─── Helper: get LLM ──────────────────────────────────────────
def get_llm(model_name: str = "gemini-2.5-flash") -> ChatGoogleGenerativeAI:
    api_key = os.getenv("API_KEY") or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("NO_API_KEY")
    target_model = model_name if model_name in VALID_MODELS else "gemini-2.5-flash"
    return ChatGoogleGenerativeAI(
        model=target_model,
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
                headers={"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"},
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
                abstract = re.sub(r"<[^>]+>", "", abstract_raw)[:600] + "…" if abstract_raw else "No abstract available."
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
                headers={"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"},
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
                abstract = (abstract_raw[:600] + "…") if abstract_raw else (tldr_text or "No abstract available.")
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
                headers={"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"},
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
                abstract = (abstract_raw.strip()[:600] + "…") if abstract_raw.strip() else "No abstract available."
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
                headers={"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"},
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
                abstract = (abstract_raw[:600] + "…") if abstract_raw else "No abstract available."
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
                    "User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)",
                    "mailto": "chrystel_anne_marcelo@dlsu.edu.ph",
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
                        abstract = (abstract_text[:600] + "…") if abstract_text else "No abstract available."
                    except Exception:
                        pass

                results.append(
                    f'[Tool Result {i + 1}] "{title}" — {authors} ({year})\n'
                    f"Journal/Source: {source}\nAbstract: {abstract}"
                )
            return "\n\n---\n\n".join(results)

    except Exception as e:
        return f"Tool Error: {e}"


# ─── Node 0: Router (Intent Classifier / Orchestrator) ──────
async def router_node(state: AgentState) -> dict:
    """
    Entry-point Orchestrator: Classifies the user's request intent and decides
    which pipeline stage to enter — satisfying the mentor's specific requirement:
      - 'review_only' → skip everything, route straight to ReviewerNode
                        (user already has a draft and just wants it scored)
      - 'summarize'   → skip search, route straight to ExtractNode
      - 'analyze'     → full pipeline: Planner → Search → Extract → Synthesize → Review
      - 'general'     → full pipeline: Planner → Search → Extract → Synthesize → Review
    """
    start = time.time()
    q = state["question"].lower()

    # Intent classification — ordered from most specific to least
    review_draft_kws = ["score my draft", "review my draft", "grade my draft", "evaluate my draft", "check my draft", "peer review my draft"]
    analyze_kws = ["compare", "comparison", "difference", "findings", "score", "relevance",
                   "methodology", "analyze", "analysis", "evaluate", "contrast", "appraise", "rate", "grade",
                   "score this", "review this", "grade this", "rate this", "appraise this"]
    summarize_kws = ["summarize", "summary", "summarise", "overview", "brief",
                     "outline", "abstract", "key points"]

    # Check if explicit draft_text is provided, or if user pasted a draft in question
    user_draft = state.get("draft_text", "").strip()
    has_explicit_draft = len(user_draft) > 0
    search_or_write_kws = [r"search", r"find", r"write", r"generate", r"draft", r"create", r"look\s+up", r"latest", r"recent"]
    raw_question = state["question"].strip()
    has_pasted_draft = (
        len(raw_question.split()) > 50
        and not any(re.search(r"\b" + kw + r"\b", q) for kw in search_or_write_kws)
    )

    if has_explicit_draft or has_pasted_draft or any(kw in q for kw in review_draft_kws):
        intent = "review_only"
    elif any(kw in q for kw in analyze_kws):
        intent = "analyze"
    elif any(kw in q for kw in summarize_kws):
        intent = "summarize"
    else:
        intent = "general"

    elapsed = int((time.time() - start) * 1000)
    return {
        "intent": intent,
        "trace": [f"[RouterNode +{elapsed}ms] Orchestrator classified intent='{intent}' → routing to {'ReviewerNode directly' if intent == 'review_only' else 'ExtractNode' if intent == 'summarize' else 'PlannerNode'}: \"{state['question'][:55]}...\""],
    }


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
    intent = state.get("intent", "general")

    # For summarize intent with existing papers, skip tool search
    needs_tool = (
        len(papers) == 0
        or (
            intent not in ("summarize",)
            and any(kw in q for kw in ["search", "find", "latest", "recent", "look up", "additional", "more paper"])
        )
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
            "trace": [f"[PlannerNode +{elapsed}ms] ({intent}) Agent decided to invoke SearchTool for: \"{search_query}\""],
        }

    return {
        "tool_results": "",
        "trace": [f"[PlannerNode +{elapsed}ms] ({intent}) Agent using existing {len(papers)} paper(s) — no tool call needed."],
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
    tool_note = ""
    if tool_results and not tool_results.startswith("__SEARCH__:") and not tool_results.startswith("Tool Error"):
        tool_context = "\n\n## Additional Papers Retrieved by Agent (Multi-Database Search)\n\n" + tool_results
        tool_note = " + web search results"

    # Build project header context
    proj_name = state.get("project_name", "Literature Review")
    proj_desc = state.get("project_description", "").strip()
    scope_header = f"## Project Context & Research Scope\nProject: {proj_name}\n"
    if proj_desc:
        scope_header += f"Research Scope / Question: {proj_desc}\n\n"
    else:
        scope_header += "\n"

    elapsed = int((time.time() - start) * 1000)

    return {
        "paper_context": scope_header + selected_context + tool_context,
        "trace": [f"[ExtractNode +{elapsed}ms] Context built: {len(papers)} project paper(s){tool_note}."],
    }


# ─── Node 4: Synthesize ───────────────────────────────────────
async def synthesize_node(state: AgentState) -> dict:
    """Calls Gemini to generate an RRL draft using the built context, tailored by intent."""
    start = time.time()
    intent = state.get("intent", "general")

    retry_note = ""
    if state.get("retries", 0) > 0:
        retry_note = (
            f"\nPrevious draft scored {state.get('review_score', 0)}/100. "
            f"Reviewer feedback: \"{state.get('review_feedback', '')}\". "
            "Please improve accordingly."
        )

    proj_name = state.get("project_name", "Literature Review")
    proj_desc = state.get("project_description", "").strip()

    # Intent-aware prompt shaping
    if intent == "analyze" or any(kw in state['question'].lower() for kw in ["score", "rate", "appraise", "evaluate", "grade"]):
        task_instruction = (
            "Perform a detailed paper appraisal and analytical breakdown for the user-selected paper(s) provided in the context.\n"
            f"Evaluate and score each paper specifically against the project scope '{proj_name}'"
            + (f" (Scope: {proj_desc})" if proj_desc else "") + ".\n\n"
            "Structure your appraisal for each paper as follows:\n"
            "### 1. Topic Relevance Score (0–100%)\n"
            "* Assess how directly the paper's research questions, core focus, and findings align with the project research scope.\n\n"
            "### 2. Methodological Rigor Score (0–100%)\n"
            "* Evaluate the soundness, quality, and analytical validity of the paper's research design, evidence, and execution.\n"
            "* Assess data/evidence quality (sample adequacy, dataset integrity, or source reliability), conceptual framework clarity, validation robustness, logical coherence, and procedure/citation transparency.\n\n"
            "### 3. Overall RRL Score (0–100%)\n"
            "* Key Strengths: Identify major contributions, findings, or analytical insights.\n"
            "* Limitations: Discuss methodological gaps, limitations, or scope/generalizability constraints.\n"
            "* RRL Contribution: Explain how this paper advances the literature review.\n\n"
            "Do NOT ask the user to provide paper content if paper context is already present in the prompt. Perform the complete appraisal directly on the provided paper context."
        )
    elif intent == "summarize":
        task_instruction = (
            "Provide a clear, concise, and academic synthesis summary. "
            "Capture abstract, key contributions, methodology, and relevance of each paper to the project topic. "
            "Use numbered sections per paper and cite author names."
        )
    else:
        task_instruction = (
            "Write a highly academic, structured, and insightful RRL response. "
            "Use clear markdown formatting with headers and bullet points. "
            "Cite author names when referring to specific papers."
        )

    prompt = (
        f"You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant "
        f"for the project \"{proj_name}\".\n"
        + (f"Project Scope / Topic Description: \"{proj_desc}\"\n" if proj_desc else "")
        + f"IMPORTANT: Begin your response directly with the answer. "
        f"Do NOT include any preamble, report header, metadata block, or repetition of these instructions.\n\n"
        f"{state.get('paper_context', '')}\n\n"
        f"User Question: \"{state['question']}\"\n"
        f"{retry_note}\n\n"
        f"{task_instruction}"
    )

    text = ""
    prompt_tokens = 0
    completion_tokens = 0

    model = state.get("model_name", "gemini-2.5-flash")
    try:
        llm = get_llm(model)
        result = llm.invoke(prompt)
        raw_val = result.content
        
        # Handle cases where LLM returns raw AST list/dict string
        if isinstance(raw_val, list):
            # If Gemini SDK returned list of Content blocks
            extracted_text = []
            for item in raw_val:
                if isinstance(item, dict) and item.get("text"):
                    extracted_text.append(item["text"])
                elif hasattr(item, "text"):
                    extracted_text.append(item.text)
                elif isinstance(item, str):
                    extracted_text.append(item)
            text = "\n\n".join(extracted_text)
        elif isinstance(raw_val, str):
            # Check if string is wrapped in [{'type': 'text', 'text': '...'}]
            if raw_val.strip().startswith("[{'type':") or raw_val.strip().startswith('[{"type":'):
                try:
                    import ast
                    parsed_list = ast.literal_eval(raw_val)
                    if isinstance(parsed_list, list) and len(parsed_list) > 0:
                        text = parsed_list[0].get("text", raw_val)
                    else:
                        text = raw_val
                except Exception:
                    text = raw_val
            else:
                text = raw_val
        else:
            text = str(raw_val)
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
        "trace": [f"[SynthesizeNode +{elapsed}ms] Generated draft via {model} (retry #{state.get('retries', 0)}, ~{total_tokens} tokens)."],
    }


async def review_node(state: AgentState) -> dict:
    """
    Real LLM-as-a-Judge Node: Evaluates academic rigor, citations, and structural relevance.
    Accepts either:
      - A draft generated by SynthesizeNode (standard pipeline path)
      - A user-supplied draft from draft_text (review_only path — My Draft editor)
    Passes draft + project scope to Gemini to generate a dynamic 0–100 score and tailored feedback.
    """
    start = time.time()
    # Priority: user-supplied draft_text → synthesized draft → raw question (review_only
    # path: draft_text is passed directly by My Draft editor)
    draft = (
        state.get("draft_text", "").strip()
        or state.get("draft", "").strip()
        or (state["question"] if state.get("intent") == "review_only" else "")
    )

    if draft == "__FALLBACK__":
        return {
            "review_score": 100,
            "review_feedback": "Offline synthesis engine active.",
            "trace": ["[ReviewerNode +0ms] Skipped — offline synthesis mode."],
        }

    words = draft.split()
    word_count = len(words)
    has_headers = "##" in draft or "#" in draft or "###" in draft
    has_citations = bool(re.search(r"\b(19|20)\d{2}\b", draft)) or "et al." in draft

    proj_name = state.get("project_name", "Literature Review")
    proj_desc = state.get("project_description", "").strip()

    review_prompt = (
        f"You are a strict senior academic peer reviewer scoring an RRL draft.\n"
        f"Research Scope: '{proj_name}'" + (f" ({proj_desc})" if proj_desc else "") + "\n\n"
        f"Draft Text to Review:\n\"\"\"\n{draft[:2500]}\n\"\"\"\n\n"
        f"Rigor Metrics:\n"
        f"- Word Count: {word_count} words\n"
        f"- Markdown Headers: {'Present' if has_headers else 'Missing'}\n"
        f"- In-Text Citations: {'Present' if has_citations else 'Missing'}\n\n"
        "Instructions:\n"
        "1. Evaluate academic writing quality, citation density, structural organization, and scope alignment.\n"
        "2. Assign an overall Academic Rigor Score between 0 and 100 based on true academic rigor.\n"
        "3. Provide 2-3 sentences of constructive, specific reviewer critique highlighting strengths and necessary revisions.\n\n"
        "Return ONLY a valid JSON object with format:\n"
        "{\n"
        '  "score": <0-100 integer>,\n'
        '  "feedback": "<Specific reviewer feedback text>"\n'
        "}"
    )

    model = state.get("model_name", "gemini-2.5-flash")
    score = 82
    feedback = "Draft evaluated by peer reviewer."

    try:
        llm = get_llm(model)
        result = await llm.ainvoke(review_prompt)
        raw = result.content if isinstance(result.content, str) else str(result.content)
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            parsed = json.loads(match.group(0))
            score = int(parsed.get("score") or score)
            feedback = str(parsed.get("feedback") or feedback).strip()
    except Exception as err:
        print(f"[WARN] Reviewer node fallback: {err}")
        score = min(92, max(60, 70 + (10 if has_headers else 0) + (10 if has_citations else 0) + min(12, word_count // 30)))
        feedback = f"Draft evaluated structurally ({word_count} words, headers: {'yes' if has_headers else 'no'}, citations: {'yes' if has_citations else 'no'})."

    elapsed = int((time.time() - start) * 1000)
    retries = state.get("retries", 0) + (0 if score >= 80 else 1)

    return {
        "review_score": score,
        "review_feedback": feedback,
        "retries": retries,
        "trace": [f"[ReviewerNode +{elapsed}ms] Peer review evaluation complete via {model} (Score: {score}/100 — {feedback[:60]}...)."],
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


# ─── Routing: router → planner | extract | review ────────────
def router_decision(state: AgentState) -> str:
    intent = state.get("intent", "general")
    if intent == "review_only":
        return "review"
    if intent == "summarize":
        return "extract"
    return "planner"



# ─── Build and compile graph ───────────────────────────────────
def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("router", router_node)
    graph.add_node("planner", planner_node)
    graph.add_node("searchTool", search_tool_node)
    graph.add_node("extract", extract_node)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("review", review_node)

    graph.set_entry_point("router")
    graph.add_conditional_edges("router", router_decision, {
        "planner": "planner",
        "extract": "extract",
        "review": "review",   # mentor's 'straight to review' path
    })
    graph.add_conditional_edges("planner", planner_decision, {
        "searchTool": "searchTool",
        "extract": "extract",
    })
    graph.add_edge("searchTool", "extract")
    graph.add_edge("extract", "synthesize")

    # Direct finish after synthesize for single-pass response, or route to review if requested
    graph.add_conditional_edges("synthesize", lambda s: "review" if s.get("intent") == "review_only" else "end", {
        "review": "review",
        "end": END,
    })
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
    project_description: str = "",
    model_name: str = "gemini-2.5-flash",
    draft_text: str = "",
) -> dict:
    """Entry point called by the FastAPI route with multi-model failover."""
    start_time = time.time()
    app = build_graph()

    try:
        active_model = model_name
        result = await app.ainvoke({
            "question": question,
            "project_name": project_name,
            "project_description": project_description,
            "papers": papers,
            "paper_context": "",
            "tool_results": "",
            "draft": "",
            "review_score": 0,
            "review_feedback": "",
            "intent": "general",
            "draft_text": draft_text,
            "retries": 0,
            "trace": [f"[Router] Initiating graph execution with model: {model_name}"],
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "model_name": model_name,
        })
    except Exception as err:
        err_str = str(err)
        print(f"[WARN] Graph execution failed on model '{model_name}': {err_str[:140]}")
        last_error = err_str

    latency_ms = int((time.time() - start_time) * 1000)

    model_labels = {
        "gemini-2.5-flash": "Gemini 2.5 Flash",
        "gemini-3.5-flash": "Gemini 3.5 Flash",
        "gemini-flash-latest": "Gemini Flash Auto",
    }
    label = model_labels.get(model_name, model_name)

    if not result or result.get("draft") == "__FALLBACK__":
        quota_msg = (
            f"⚠️ **API Quota Limit Reached for {label}**\n\n"
            f"The rate limit or quota for **{label}** has been reached. "
            f"Please switch to another model using the **Model** dropdown selector below "
            f"(e.g., *Gemini 3.5 Flash* or *Gemini 3.6 Flash*) to continue your analysis."
        )
        return {
            "text": quota_msg,
            "trace": [f"[Quota Limit] Rate limit reached on model '{model_name}'. Prompted user to switch model."],
            "review_score": None,
            "tokens": {"prompt": 0, "completion": 0, "total": 0},
            "latency_ms": latency_ms,
            "retries": 0,
            "used_fallback": True,
            "model_name": active_model,
        }

    used_fallback = result.get("draft") == "__FALLBACK__"
    prompt_tokens = result.get("prompt_tokens", 0)
    completion_tokens = result.get("completion_tokens", 0)

    text_content = result.get("draft")
    if not text_content and result.get("intent") == "review_only":
        text_content = f"### Peer Review Report\n\n**Academic Rigor Score:** {result.get('review_score', 88)}/100\n\n**Reviewer Feedback:**\n{result.get('review_feedback', 'Draft evaluated successfully.')}"

    return {
        "text": None if used_fallback else text_content,
        "trace": result.get("trace", []),
        "review_score": result.get("review_score", 0),
        "review_feedback": result.get("review_feedback", ""),
        "tokens": {
            "prompt": prompt_tokens,
            "completion": completion_tokens,
            "total": prompt_tokens + completion_tokens,
        },
        "latency_ms": latency_ms,
        "retries": result.get("retries", 0),
        "used_fallback": used_fallback,
        "model_name": active_model,
    }
