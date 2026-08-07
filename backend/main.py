"""
backend/main.py
FastAPI application for LitAssist Python backend.
Exposes POST /chat which runs the LangGraph agent pipeline.
"""
import os
import io
import re
import asyncio
import httpx
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

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
            model_name=body.modelName,
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
            model_name=result.get("model_name", "gemini-1.5-flash"),
        )
    except Exception as e:
        print(f"[ERROR] LangGraph agent failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


import json


@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """
    Extract text content, title, authors, abstract, year, and journal from an uploaded PDF paper using Gemini AI.
    """
    try:
        contents = await file.read()
        reader = PdfReader(io.BytesIO(contents))

        extracted_pages = []
        for page in reader.pages:
            t = page.extract_text() or ""
            if t.strip():
                extracted_pages.append(t)

        full_text = "\n\n".join(extracted_pages).strip()
        if not full_text:
            return {"error": "Could not extract text from PDF (file may be scanned image or empty)."}

        # Use Gemini AI with failover for accurate metadata extraction
        try:
            from agent.graph import get_llm
            ai_res = None
            for model_id in ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-flash-latest"]:
                try:
                    llm = get_llm(model_id)
                    prompt = (
                        "You are an academic PDF parser. Extract paper metadata from this PDF text.\n"
                        "Return ONLY a valid JSON object matching this exact structure with no extra text or markdown:\n"
                        "{\n"
                        '  "title": "Full complete paper title",\n'
                        '  "authors": "First Author, et al.",\n'
                        '  "year": "2024",\n'
                        '  "journal": "Full Journal or Publisher Name",\n'
                        '  "abstract": "Full complete abstract text verbatim",\n'
                        '  "methodology": "Specific research design, models, datasets, or algorithms used (1-2 concise sentences)",\n'
                        '  "key_findings": [\n'
                        '    "Key empirical result 1 with specific accuracy/metrics if available",\n'
                        '    "Key contribution 2",\n'
                        '    "Key outcome 3"\n'
                        '  ]\n'
                        "}\n\n"
                        f"PDF Text:\n{full_text[:4000]}"
                    )
                    ai_res = llm.invoke(prompt)
                    break
                except Exception as m_err:
                    if "429" in str(m_err) or "RESOURCE_EXHAUSTED" in str(m_err):
                        continue
                    raise m_err

            if ai_res:
                raw_content = ai_res.content if isinstance(ai_res.content, str) else str(ai_res.content)
                json_match = re.search(r"\{[\s\S]*\}", raw_content)
            if json_match:
                parsed = json.loads(json_match.group(0))

                authors_val = parsed.get("authors")
                if isinstance(authors_val, list):
                    raw_names = [str(a).strip() for a in authors_val if str(a).strip()]
                else:
                    raw_names = [a.strip() for a in str(authors_val or "").split(",") if a.strip()]

                if len(raw_names) > 2:
                    first = raw_names[0]
                    last = first.split()[-1] if " " in first else first
                    authors_str = f"{last}, et al."
                elif len(raw_names) == 2:
                    n1 = raw_names[0].split()[-1] if " " in raw_names[0] else raw_names[0]
                    n2 = raw_names[1].split()[-1] if " " in raw_names[1] else raw_names[1]
                    authors_str = f"{n1} & {n2}"
                elif len(raw_names) == 1:
                    authors_str = raw_names[0]
                else:
                    authors_str = "Unknown Author"

                key_findings = parsed.get("key_findings")
                if not isinstance(key_findings, list):
                    key_findings = []

                return {
                    "title": str(parsed.get("title") or file.filename.replace(".pdf", "")).strip(),
                    "authors": authors_str.strip(),
                    "abstract": str(parsed.get("abstract") or "Abstract extracted from PDF.").strip(),
                    "methodology": str(parsed.get("methodology") or "").strip(),
                    "key_findings": [str(f).strip() for f in key_findings if str(f).strip()],
                    "year": str(parsed.get("year") or "2025").strip(),
                    "journal": str(parsed.get("journal") or "Academic Publication").strip(),
                    "full_text": full_text[:3000],
                    "num_pages": len(reader.pages),
                }
        except Exception as ai_err:
            print(f"[WARN] Gemini PDF extraction fallback: {ai_err}")

        # Fallback to filename if AI extraction fails
        raw_filename = file.filename or "Research Paper"
        clean_title = raw_filename.replace(".pdf", "").replace("_", " ").replace("-", " ").strip()

        return {
            "title": clean_title.title(),
            "authors": "Unknown Author",
            "abstract": full_text[:800].strip(),
            "year": "2025",
            "journal": "Academic Publication",
            "full_text": full_text[:3000],
            "num_pages": len(reader.pages),
        }
    except Exception as e:
        print(f"[ERROR] PDF parsing failed: {e}")
        return {"error": f"Failed to parse PDF file: {str(e)}"}


class AnalyzeInput(BaseModel):
    title: str
    abstract: str


@app.post("/analyze-abstract")
async def analyze_abstract(body: AnalyzeInput):
    """
    Use Gemini AI to clean Crossref abstract text and extract methodology, key findings, research gap, and relevance score.
    """
    clean_abstract = re.sub(r"^abstract[—:\s\.\-]*", "", body.abstract, flags=re.I).strip()
    if clean_abstract.startswith("Abstract") and len(clean_abstract) > 8 and clean_abstract[8].isupper():
        clean_abstract = clean_abstract[8:].strip()

    if not clean_abstract or len(clean_abstract) < 25:
        return {
            "clean_abstract": clean_abstract,
            "methodology": "No methodology detailed in brief abstract.",
            "key_findings": ["No empirical findings available."],
            "research_gap": "Limited abstract text provided.",
            "relevance_score": 75,
        }

    try:
        from agent.graph import get_llm
        for model_id in ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-flash-latest"]:
            try:
                llm = get_llm(model_id)
                prompt = (
                    "You are an academic paper analyzer. Analyze this paper title and abstract.\n"
                    "Return ONLY a valid JSON object matching this structure with no extra text or markdown:\n"
                    "{\n"
                    '  "clean_abstract": "Abstract text stripped of any leading Abstract header words",\n'
                    '  "methodology": "Concise 1-2 sentence methodology summary (research design, approaches, datasets, review type)",\n'
                    '  "key_findings": [\n'
                    '    "Empirical finding 1",\n'
                    '    "Empirical finding 2",\n'
                    '    "Empirical finding 3"\n'
                    '  ],\n'
                    '  "research_gap": "Key limitations, unaddressed questions, or future directions mentioned (1-2 sentences)",\n'
                    '  "relevance_score": 88\n'
                    "}\n\n"
                    f"Title: {body.title}\n"
                    f"Abstract: {clean_abstract}"
                )

                res = llm.invoke(prompt)
                raw = res.content if isinstance(res.content, str) else str(res.content)
                match = re.search(r"\{[\s\S]*\}", raw)
                if match:
                    parsed = json.loads(match.group(0))
                    return {
                        "clean_abstract": str(parsed.get("clean_abstract") or clean_abstract).strip(),
                        "methodology": str(parsed.get("methodology") or "").strip(),
                        "key_findings": [str(f).strip() for f in parsed.get("key_findings", []) if str(f).strip()][:3],
                        "research_gap": str(parsed.get("research_gap") or "The authors acknowledge limitations in dataset scope and cross-domain generalizability.").strip(),
                        "relevance_score": int(parsed.get("relevance_score") or 88),
                    }
            except Exception as m_err:
                if "429" in str(m_err) or "RESOURCE_EXHAUSTED" in str(m_err):
                    continue
                raise m_err
    except Exception as e:
        print(f"[WARN] Abstract analysis fallback: {e}")

    # Heuristic fallback if AI is rate-limited
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_abstract) if s.strip()]
    methodology_fallback = sentences[0] if sentences else clean_abstract[:200]
    findings_fallback = sentences[1:4] if len(sentences) > 1 else [clean_abstract[:150]]

    return {
        "clean_abstract": clean_abstract,
        "methodology": methodology_fallback,
        "key_findings": findings_fallback,
        "research_gap": "The study acknowledges limitations in dataset diversity and geographic scope. Future work should address cross-domain applicability.",
        "relevance_score": 85,
    }


class DoiInput(BaseModel):
    doi: str


@app.post("/resolve-doi")
async def resolve_doi(body: DoiInput):
    """
    Resolve a DOI to full paper metadata, complete abstract, direct Open-Access PDF link,
    publisher landing page, methodology, and key findings using Crossref, OpenAlex, and Gemini AI.
    """
    query = body.doi.strip()
    if not query:
        return {"error": "Empty DOI or query."}

    doi_match = re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", query)
    clean_doi = doi_match.group(0).rstrip(".") if doi_match else None

    title = ""
    authors = ""
    year = "2025"
    journal = "Academic Publication"
    abstract = ""
    pdf_url = ""
    landing_url = f"https://doi.org/{clean_doi}" if clean_doi else ""
    tags = ["RRL Source", "Scholarly Paper"]

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            headers = {"User-Agent": "LitAssist/1.0 (mailto:chrystel_anne_marcelo@dlsu.edu.ph)"}

            tasks = []
            if clean_doi:
                tasks.append(client.get(f"https://api.crossref.org/works/{clean_doi}", headers=headers))
                tasks.append(client.get(f"https://api.openalex.org/works/https://doi.org/{clean_doi}", headers=headers))
            else:
                tasks.append(client.get(f"https://api.crossref.org/works?query={query}&rows=1", headers=headers))
                tasks.append(client.get(f"https://api.openalex.org/works?search={query}&per-page=1", headers=headers))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Parse Crossref
            if len(results) > 0 and not isinstance(results[0], Exception) and results[0].status_code == 200:
                data = results[0].json().get("message", {})
                if data.get("items"):
                    data = data["items"][0]

                title = (data.get("title") or [""])[0]
                if data.get("author"):
                    raw_authors = [f"{a.get('family', '')}, {a.get('given', '')}".strip(", ") for a in data["author"]]
                    if len(raw_authors) > 2:
                        authors = f"{raw_authors[0].split(',')[0]}, et al."
                    elif len(raw_authors) == 2:
                        authors = f"{raw_authors[0].split(',')[0]} & {raw_authors[1].split(',')[0]}"
                    elif len(raw_authors) == 1:
                        authors = raw_authors[0]

                pub_date = data.get("published-print") or data.get("published-online") or data.get("issued") or {}
                if pub_date.get("date-parts"):
                    year = str(pub_date["date-parts"][0][0])

                if data.get("container-title"):
                    journal = data["container-title"][0]
                elif data.get("publisher"):
                    journal = data["publisher"]

                if data.get("abstract"):
                    abstract = re.sub(r"<[^>]*>?|\babstract[:\s—\.-]*", "", data["abstract"], flags=re.I).strip()

                if data.get("subject"):
                    tags = [str(s) for s in data["subject"][:4]]

            # Parse OpenAlex for PDF URL, landing page, and missing abstract
            if len(results) > 1 and not isinstance(results[1], Exception) and results[1].status_code == 200:
                oa_res = results[1].json()
                items = oa_res.get("results") if "results" in oa_res else [oa_res]
                if items and items[0]:
                    oa_data = items[0]
                    if not title:
                        title = oa_data.get("title") or ""
                    if not authors and oa_data.get("authorships"):
                        names = [a.get("author", {}).get("display_name", "") for a in oa_data["authorships"]]
                        if len(names) > 2:
                            authors = f"{names[0].split()[-1]}, et al."
                        elif len(names) == 2:
                            authors = f"{names[0].split()[-1]} & {names[1].split()[-1]}"
                        elif len(names) == 1:
                            authors = names[0]

                    best_oa = oa_data.get("best_oa_location") or {}
                    pdf_url = best_oa.get("pdf_url") or ""
                    landing_url = (oa_data.get("primary_location") or {}).get("landing_page_url") or landing_url

                    if not abstract and oa_data.get("abstract_inverted_index"):
                        inv = oa_data["abstract_inverted_index"]
                        max_p = max(p for pos in inv.values() for p in pos)
                        words = [""] * (max_p + 1)
                        for w, positions in inv.items():
                            for pos in positions:
                                words[pos] = w
                        abstract = " ".join(words).strip()

    except Exception as err:
        print(f"[WARN] Online DOI resolution error: {err}")

    clean_abstract = re.sub(r"^abstract[—:\s\.\-]*", "", abstract, flags=re.I).strip()

    # Use Gemini AI to extract clean methodology & key findings
    methodology = ""
    key_findings = []
    if title and clean_abstract:
        try:
            from agent.graph import get_llm
            llm = get_llm("gemini-2.5-flash")
            prompt = (
                "You are an academic paper analyzer. Analyze this paper title and abstract.\n"
                "Return ONLY a valid JSON object matching this structure:\n"
                "{\n"
                '  "clean_abstract": "Clean abstract text verbatim",\n'
                '  "methodology": "Concise 1-2 sentence methodology summary (research design, approaches, datasets)",\n'
                '  "key_findings": ["Empirical finding 1", "Empirical finding 2", "Empirical finding 3"]\n'
                "}\n\n"
                f"Title: {title}\nAbstract: {clean_abstract}"
            )
            res = llm.invoke(prompt)
            raw = res.content if isinstance(res.content, str) else str(res.content)
            match = re.search(r"\{[\s\S]*\}", raw)
            if match:
                parsed = json.loads(match.group(0))
                clean_abstract = str(parsed.get("clean_abstract") or clean_abstract).strip()
                methodology = str(parsed.get("methodology") or "").strip()
                key_findings = [str(f).strip() for f in parsed.get("key_findings", []) if str(f).strip()][:3]
        except Exception as ai_err:
            print(f"[WARN] Gemini abstract analysis failed: {ai_err}")

    if not methodology and clean_abstract:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_abstract) if s.strip()]
        methodology = sentences[0] if sentences else ""
        key_findings = sentences[1:4] if len(sentences) > 1 else []

    return {
        "title": title or query,
        "authors": authors or "Unknown Author",
        "year": year,
        "journal": journal,
        "abstract": clean_abstract,
        "methodology": methodology,
        "key_findings": key_findings,
        "tags": tags,
        "doi": clean_doi,
        "url": landing_url,
        "pdf_url": pdf_url,
    }

