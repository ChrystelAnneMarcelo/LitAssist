"""
backend/verification.py
Paper authenticity signals — entirely LLM-free, per the design discussion:
"you don't really need an LLM to tell the document is empty."

Two independent checks:
  1. check_pdf_content_quality() — local, zero-cost. Does the extracted
     PDF text actually look like a real document (not blank, not garbled,
     not suspiciously thin)? PDF uploads only.
  2. verify_against_indexes() — queries Crossref, Semantic Scholar, arXiv,
     PubMed (via Europe PMC), and OpenAlex in parallel, then computes a
     plain string-similarity match (difflib) against the best result.
     No LLM call anywhere in this path — pure API calls + string matching.

Both checks answer different questions and can disagree: a real paper can
fail the index check (wrong index, unusual title formatting) without being
fake, and a fabricated title could theoretically coincidentally resemble a
real one. Neither check is proof on its own — they're signals, and the
badges built from them are phrased that way (see main.py), not as a
pass/fail verdict.
"""
import asyncio
import re
from difflib import SequenceMatcher

import httpx

SIMILARITY_THRESHOLD = 0.85
_TIMEOUT = 8.0
_HEADERS = {"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"}


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


# ─── Per-index search helpers — each returns {source, title, url} or None ──
async def _search_crossref(title: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://api.crossref.org/works",
                params={"query.bibliographic": title, "rows": "1", "select": "title,DOI"},
                headers=_HEADERS,
            )
            items = resp.json().get("message", {}).get("items", [])
            if not items:
                return None
            item = items[0]
            doi = item.get("DOI")
            return {
                "source": "Crossref",
                "title": (item.get("title") or [""])[0],
                "url": f"https://doi.org/{doi}" if doi else None,
            }
    except Exception:
        return None


async def _search_semantic_scholar(title: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://api.semanticscholar.org/graph/v1/paper/search",
                params={"query": title, "limit": "1", "fields": "title,url"},
            )
            data = resp.json().get("data", [])
            if not data:
                return None
            item = data[0]
            return {"source": "Semantic Scholar", "title": item.get("title", ""), "url": item.get("url")}
    except Exception:
        return None


async def _search_arxiv(title: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "http://export.arxiv.org/api/query",
                params={"search_query": f'ti:"{title}"', "max_results": "1"},
            )
            entries = re.findall(r"<entry>(.*?)</entry>", resp.text, re.DOTALL)
            if not entries:
                return None
            title_m = re.search(r"<title>(.*?)</title>", entries[0], re.DOTALL)
            id_m = re.search(r"<id>(.*?)</id>", entries[0], re.DOTALL)
            if not title_m:
                return None
            return {
                "source": "arXiv",
                "title": title_m.group(1).strip().replace("\n", " "),
                "url": id_m.group(1).strip() if id_m else None,
            }
    except Exception:
        return None


async def _search_pubmed(title: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
                params={"query": title, "format": "json", "pageSize": "1"},
            )
            results = resp.json().get("resultList", {}).get("result", [])
            if not results:
                return None
            item = results[0]
            pmid = item.get("pmid")
            return {
                "source": "PubMed",
                "title": item.get("title", ""),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None,
            }
    except Exception:
        return None


async def _search_openalex(title: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get("https://api.openalex.org/works", params={"search": title, "per-page": "1"})
            results = resp.json().get("results", [])
            if not results:
                return None
            item = results[0]
            return {"source": "OpenAlex", "title": item.get("title", ""), "url": item.get("id")}
    except Exception:
        return None


async def verify_against_indexes(title: str) -> dict:
    """
    Queries all 5 indexes in parallel, returns the best title match above
    SIMILARITY_THRESHOLD, or a not-matched result. No LLM involved.
    """
    if not title or not title.strip():
        return {"matched": False, "source": None, "url": None, "similarity": 0.0}

    results = await asyncio.gather(
        _search_crossref(title),
        _search_semantic_scholar(title),
        _search_arxiv(title),
        _search_pubmed(title),
        _search_openalex(title),
    )

    best, best_score = None, 0.0
    for r in results:
        if not r or not r.get("title"):
            continue
        score = _similarity(title, r["title"])
        if score > best_score:
            best, best_score = r, score

    if best and best_score >= SIMILARITY_THRESHOLD:
        return {"matched": True, "source": best["source"], "url": best.get("url"), "similarity": round(best_score, 2)}
    return {"matched": False, "source": None, "url": None, "similarity": round(best_score, 2)}


def check_pdf_content_quality(full_text: str, num_pages: int) -> dict:
    """
    Local, zero-cost: does the extracted text look like a real document?
    No LLM or network call — answerable from the extracted text alone.
    """
    text = (full_text or "").strip()
    if not text:
        return {"passed": False, "reason": "No extractable text — likely a scanned image or empty file."}

    words = text.split()
    if len(words) < 50:
        return {"passed": False, "reason": f"Only {len(words)} words extracted — too thin for a research paper."}

    alpha_chars = sum(1 for c in text if c.isalpha())
    if len(text) > 0 and (alpha_chars / len(text)) < 0.5:
        return {"passed": False, "reason": "Extracted text is mostly non-alphabetic — likely corrupted."}

    avg_words_per_page = len(words) / max(num_pages, 1)
    if avg_words_per_page < 30:
        return {"passed": False, "reason": f"Low text density (~{avg_words_per_page:.0f} words/page) — possibly scanned or blank."}

    return {"passed": True, "reason": None}
