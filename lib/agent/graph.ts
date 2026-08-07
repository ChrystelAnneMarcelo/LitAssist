import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { Paper, AgentResponse } from "./schemas";

// ─── Agent State ─────────────────────────────────────────────
const AgentState = Annotation.Root({
  question: Annotation<string>(),
  projectName: Annotation<string>(),
  projectDescription: Annotation<string>(),
  papers: Annotation<Paper[]>(),
  paperContext: Annotation<string>(),
  toolResults: Annotation<string>(),  // results from search tool
  draft: Annotation<string>(),
  reviewScore: Annotation<number>(),
  reviewFeedback: Annotation<string>(),
  retries: Annotation<number>(),
  trace: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
  promptTokens: Annotation<number>(),
  completionTokens: Annotation<number>(),
});

// ─── Helper: get LLM ─────────────────────────────────────────
function getLLM() {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("NO_API_KEY");
  return new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    apiKey,
    temperature: 0.4,
  });
}

// ─── Tool Definition: Crossref Paper Search ───────────────────
// This is the agent's external tool — it calls Crossref to retrieve
// additional scholarly metadata for papers not already in the user's collection.
async function crossrefSearchTool(query: string): Promise<string> {
  const encoded = encodeURIComponent(query);
  const url = `https://api.crossref.org/works?query=${encoded}&rows=3&select=title,author,published,container-title,abstract,DOI`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LitAssist/1.0 (mailto:research@litassist.app)" },
    });
    if (!res.ok) return `Tool Error: Crossref returned HTTP ${res.status}`;

    const data = await res.json();
    const items = data.message?.items ?? [];

    if (!items.length) return "No results found via Crossref for this query.";

    return items.map((item: any, i: number) => {
      const title = item.title?.[0] ?? "Untitled";
      const authors = item.author
        ? item.author.slice(0, 3).map((a: any) => `${a.family}, ${a.given ?? ""}`.trim()).join("; ")
        : "Unknown Authors";
      const year = item.published?.["date-parts"]?.[0]?.[0] ?? "N/A";
      const journal = (item["container-title"] as string[])?.[0] ?? "N/A";
      const doi = item.DOI ?? "N/A";
      const abstract = item.abstract
        ? item.abstract.replace(/<[^>]+>/g, "").slice(0, 250) + "…"
        : "No abstract available.";
      return `[Tool Result ${i + 1}] "${title}" — ${authors} (${year})\nJournal: ${journal} | DOI: ${doi}\nAbstract: ${abstract}`;
    }).join("\n\n---\n\n");
  } catch (err: any) {
    return `Tool Error: ${err.message}`;
  }
}

// ─── Node 1: Planner ─────────────────────────────────────────
// The Planner decides whether to call the search tool based on the question
// and available papers. This is what makes LitAssist a true "agent" —
// it autonomously decides when to invoke an external tool.
async function plannerNode(state: typeof AgentState.State) {
  const start = Date.now();
  const papers = state.papers ?? [];
  const q = state.question.toLowerCase();

  // Heuristic: the agent decides to call the tool if:
  // (a) no papers are loaded, or
  // (b) the question asks for external references, latest work, or additional sources
  const needsToolCall =
    papers.length === 0 ||
    q.includes("search") ||
    q.includes("find") ||
    q.includes("latest") ||
    q.includes("recent") ||
    q.includes("look up") ||
    q.includes("additional") ||
    q.includes("more papers");

  const elapsed = Date.now() - start;

  if (needsToolCall) {
    // Extract a search query from the question (simplified)
    const searchQuery = papers.length > 0
      ? `${state.projectName} ${papers[0]?.tags?.[0] ?? ""}`
      : state.question;

    return {
      trace: [`[PlannerNode +${elapsed}ms] Agent decided to invoke SearchTool for: "${searchQuery}"`],
      toolResults: `__SEARCH__:${searchQuery}`,
    };
  }

  return {
    trace: [`[PlannerNode +${elapsed}ms] Agent decided to use existing ${papers.length} paper(s) — no tool call needed.`],
    toolResults: "",
  };
}

// ─── Node 2: Search Tool ──────────────────────────────────────
// The agent's tool node. Only runs when the Planner decides to call it.
async function searchToolNode(state: typeof AgentState.State) {
  const start = Date.now();

  if (!state.toolResults?.startsWith("__SEARCH__:")) {
    return { trace: [`[SearchToolNode +0ms] Skipped — no tool call requested.`] };
  }

  const query = state.toolResults.replace("__SEARCH__:", "");
  const results = await crossrefSearchTool(query);
  const elapsed = Date.now() - start;

  return {
    toolResults: results,
    trace: [`[SearchToolNode +${elapsed}ms] Crossref tool returned ${results.startsWith("No results") || results.startsWith("Tool Error") ? "0" : "up to 3"} result(s) for "${query}"`],
  };
}

// ─── Node 3: Extract / Context Builder ───────────────────────
async function extractNode(state: typeof AgentState.State) {
  const start = Date.now();
  const papers = state.papers ?? [];

  // Build context from user-selected papers (context injection)
  const selectedContext = papers.length > 0
    ? "## User-Selected Papers (Project Context)\n\n" + papers.map((p, i) => `
Paper ${i + 1}:
Title: ${p.title}
Authors: ${p.authors} (${p.year})
Journal: ${p.journal || "N/A"}
Tags: ${Array.isArray(p.tags) ? p.tags.join(", ") : "N/A"}
Abstract: ${p.abstract || "N/A"}
Methodology: ${p.methodology || "N/A"}
Key Findings: ${Array.isArray(p.keyFindings) ? p.keyFindings.join("; ") : "N/A"}
`.trim()).join("\n---\n")
    : "No project papers selected by user.";

  // Append tool results if the SearchTool ran
  const toolContext =
    state.toolResults &&
    !state.toolResults.startsWith("__SEARCH__:") &&
    !state.toolResults.startsWith("Tool Error")
      ? "\n\n## Additional Papers Retrieved by Agent (Crossref Tool)\n\n" + state.toolResults
      : "";

  const paperContext = selectedContext + toolContext;
  const elapsed = Date.now() - start;

  return {
    paperContext,
    trace: [
      `[ExtractNode +${elapsed}ms] Context built: ${papers.length} project paper(s)${toolContext ? " + Crossref tool results" : ""}.`,
    ],
  };
}

// ─── Node 4: Synthesize ───────────────────────────────────────
async function synthesizeNode(state: typeof AgentState.State) {
  const start = Date.now();
  const retryNote = state.retries > 0
    ? `\nPrevious draft scored ${state.reviewScore}/100. Reviewer feedback: "${state.reviewFeedback}". Please improve accordingly.`
    : "";

  const prompt = `You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant.
Project: "${state.projectName || "Literature Review"}".

${state.paperContext}

User Question: "${state.question}"
${retryNote}

Write a highly academic, structured, and insightful RRL response. Use clear markdown formatting with headers and bullet points. Cite author names when referring to specific papers.`;

  let text = "";
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    const llm = getLLM();
    const result = await llm.invoke(prompt);
    text = typeof result.content === "string"
      ? result.content
      : result.content.map((c: any) => ("text" in c ? c.text : "")).join("");

    promptTokens = Math.ceil(prompt.length / 4);
    completionTokens = Math.ceil(text.length / 4);
  } catch (err: any) {
    if (err?.message === "NO_API_KEY") {
      text = "__FALLBACK__";
    } else {
      throw err;
    }
  }

  const elapsed = Date.now() - start;
  return {
    draft: text,
    promptTokens: (state.promptTokens || 0) + promptTokens,
    completionTokens: (state.completionTokens || 0) + completionTokens,
    trace: [`[SynthesizeNode +${elapsed}ms] Generated draft (retry #${state.retries}, ~${promptTokens + completionTokens} tokens).`],
  };
}

// ─── Node 5: Reviewer (LLM-as-judge) ─────────────────────────
async function reviewNode(state: typeof AgentState.State) {
  const start = Date.now();

  if (state.draft === "__FALLBACK__") {
    return {
      reviewScore: 100,
      reviewFeedback: "Offline synthesis engine active (no API key configured).",
      trace: [`[ReviewerNode +0ms] Skipped — offline synthesis mode.`],
    };
  }

  const reviewPrompt = `You are a strict academic peer reviewer evaluating an AI-generated Literature Review (RRL) draft.

User Question: "${state.question}"
Paper Context Available: ${state.papers.length} project papers${state.toolResults && !state.toolResults.startsWith("__SEARCH__:") ? " + Crossref tool results" : ""}
Draft:
${state.draft}

Score this draft from 0–100 based on:
- Academic rigor and citation of provided papers (40 pts)
- Clarity and structure (30 pts)
- Relevance to the research question (30 pts)

Respond in this exact JSON format:
{
  "score": <number 0-100>,
  "feedback": "<one sentence of concrete improvement advice>",
  "approved": <true if score >= 80, false otherwise>
}`;

  let score = 85;
  let feedback = "Draft meets academic standards.";
  let approved = true;

  try {
    const llm = getLLM();
    const result = await llm.invoke(reviewPrompt);
    const raw = typeof result.content === "string"
      ? result.content
      : result.content.map((c: any) => ("text" in c ? c.text : "")).join("");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      score = Number(parsed.score) || 85;
      feedback = String(parsed.feedback || "");
      approved = Boolean(parsed.approved);
    }
  } catch {
    // Keep defaults on parse error
  }

  const elapsed = Date.now() - start;
  return {
    reviewScore: score,
    reviewFeedback: feedback,
    retries: (state.retries || 0) + (score < 80 ? 1 : 0),
    trace: [`[ReviewerNode +${elapsed}ms] Score: ${score}/100. ${approved ? "Approved." : "Needs revision: " + feedback}`],
  };
}

// ─── Conditional routing ──────────────────────────────────────
const MAX_RETRIES = 3;

function plannerDecision(state: typeof AgentState.State): string {
  // If planner set a search request, go to search tool first
  return state.toolResults?.startsWith("__SEARCH__:") ? "searchTool" : "extract";
}

function shouldRetry(state: typeof AgentState.State): string {
  if (state.draft === "__FALLBACK__") return "end";
  if (state.reviewScore >= 80 || state.retries >= MAX_RETRIES) return "end";
  return "synthesize";
}

// ─── Build graph ─────────────────────────────────────────────
function buildGraph() {
  const graph = new StateGraph(AgentState)
    .addNode("planner", plannerNode)
    .addNode("searchTool", searchToolNode)
    .addNode("extract", extractNode)
    .addNode("synthesize", synthesizeNode)
    .addNode("review", reviewNode)
    .addEdge("__start__", "planner")
    // Planner conditionally routes to searchTool or directly to extract
    .addConditionalEdges("planner", plannerDecision, {
      searchTool: "searchTool",
      extract: "extract",
    })
    .addEdge("searchTool", "extract")
    .addEdge("extract", "synthesize")
    .addEdge("synthesize", "review")
    .addConditionalEdges("review", shouldRetry, {
      synthesize: "synthesize",
      end: END,
    });

  return graph.compile();
}

// ─── Public runner ────────────────────────────────────────────
export async function runLitAssistGraph(input: {
  question: string;
  papers: Paper[];
  projectName?: string;
  projectDescription?: string;
}): Promise<AgentResponse & { usedFallback: boolean }> {
  const startTime = Date.now();

  const app = buildGraph();
  const result = await app.invoke({
    question: input.question,
    papers: input.papers,
    projectName: input.projectName || "Literature Review",
    projectDescription: input.projectDescription || "",
    paperContext: "",
    toolResults: "",
    draft: "",
    reviewScore: 0,
    reviewFeedback: "",
    retries: 0,
    trace: [],
    promptTokens: 0,
    completionTokens: 0,
  });

  const latencyMs = Date.now() - startTime;
  const usedFallback = result.draft === "__FALLBACK__";
  const totalTokens = (result.promptTokens || 0) + (result.completionTokens || 0);

  return {
    text: usedFallback ? null as any : result.draft,
    trace: result.trace || [],
    reviewScore: result.reviewScore || 0,
    tokens: {
      prompt: result.promptTokens || 0,
      completion: result.completionTokens || 0,
      total: totalTokens,
    },
    latencyMs,
    retries: result.retries || 0,
    usedFallback,
  };
}
