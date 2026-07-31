import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { Paper, AgentResponse } from "./schemas";

// ─── Agent State ─────────────────────────────────────────────
const AgentState = Annotation.Root({
  question: Annotation<string>(),
  projectName: Annotation<string>(),
  papers: Annotation<Paper[]>(),
  paperContext: Annotation<string>(),
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

// ─── Node 1: Extract ─────────────────────────────────────────
async function extractNode(state: typeof AgentState.State) {
  const start = Date.now();
  const papers = state.papers ?? [];

  const paperContext = papers.length > 0
    ? papers.map((p, i) => `
Paper ${i + 1}:
Title: ${p.title}
Authors: ${p.authors} (${p.year})
Journal: ${p.journal || "N/A"}
Tags: ${Array.isArray(p.tags) ? p.tags.join(", ") : "N/A"}
Abstract: ${p.abstract || "N/A"}
Methodology: ${p.methodology || "N/A"}
Key Findings: ${Array.isArray(p.keyFindings) ? p.keyFindings.join("; ") : "N/A"}
`.trim()).join("\n---\n")
    : `No specific papers selected. Context: ${state.projectName || "General RRL Analysis"}`;

  const elapsed = Date.now() - start;
  return {
    paperContext,
    trace: [`[ExtractNode +${elapsed}ms] Loaded ${papers.length} paper(s) into RAG context.`],
  };
}

// ─── Node 2: Synthesize ───────────────────────────────────────
async function synthesizeNode(state: typeof AgentState.State) {
  const start = Date.now();
  const retryNote = state.retries > 0
    ? `\nPrevious draft scored ${state.reviewScore}/100. Reviewer feedback: "${state.reviewFeedback}". Please improve accordingly.`
    : "";

  const prompt = `You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant.
Project: "${state.projectName || "Literature Review"}".

Literature Context:
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

    // Estimate token counts (Gemini API doesn't always return exact usage)
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

// ─── Node 3: Review ───────────────────────────────────────────
async function reviewNode(state: typeof AgentState.State) {
  const start = Date.now();

  // If no API key, skip review scoring
  if (state.draft === "__FALLBACK__") {
    return {
      reviewScore: 100,
      reviewFeedback: "Offline synthesis engine active (no API key configured).",
      trace: [`[ReviewerNode +0ms] Skipped — offline synthesis mode.`],
    };
  }

  const reviewPrompt = `You are a strict academic peer reviewer evaluating an AI-generated Literature Review (RRL) draft.

User Question: "${state.question}"
Paper Context Available: ${state.papers.length} papers
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
    trace: [`[ReviewerNode +${elapsed}ms] Score: ${score}/100. ${approved ? "✓ Approved." : "✗ Needs revision: " + feedback}`],
  };
}

// ─── Conditional edge: retry or end ──────────────────────────
const MAX_RETRIES = 3;

function shouldRetry(state: typeof AgentState.State): string {
  if (state.draft === "__FALLBACK__") return "end";
  if (state.reviewScore >= 80 || state.retries >= MAX_RETRIES) return "end";
  return "synthesize";
}

// ─── Build graph ─────────────────────────────────────────────
function buildGraph() {
  const graph = new StateGraph(AgentState)
    .addNode("extract", extractNode)
    .addNode("synthesize", synthesizeNode)
    .addNode("review", reviewNode)
    .addEdge("__start__", "extract")
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
}): Promise<AgentResponse & { usedFallback: boolean }> {
  const startTime = Date.now();

  const app = buildGraph();
  const result = await app.invoke({
    question: input.question,
    papers: input.papers,
    projectName: input.projectName || "Literature Review",
    paperContext: "",
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
