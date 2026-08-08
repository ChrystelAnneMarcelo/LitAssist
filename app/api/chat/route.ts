import { NextResponse } from "next/server";

/**
 * Thin proxy → Python FastAPI backend (http://localhost:8000/chat)
 *
 * To switch to your team's production API, set PYTHON_BACKEND_URL in .env.local:
 *   PYTHON_BACKEND_URL=https://your-deployed-backend.com
 */
const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Python backend error:", err);
      return NextResponse.json({ text: null, error: err }, { status: res.status });
    }

    const data = await res.json();

    // Normalize snake_case → camelCase for the frontend
    return NextResponse.json({
      text: data.text ?? null,
      trace: data.trace ?? [],
      tokens: data.tokens ?? { prompt: 0, completion: 0, total: 0 },
      latencyMs: data.latency_ms ?? 0,
      reviewScore: data.review_score ?? null,
      reviewFeedback: data.review_feedback ?? null,
      criteriaScores: data.criteria_scores ?? null,
      retries: data.retries ?? 0,
      usedFallback: data.used_fallback ?? false,
      modelName: data.model_name ?? "gemini-2.5-flash",
    });

  } catch (err: any) {
    // Python backend is not running — signal frontend to use offline synthesis
    console.warn("Python backend unreachable, falling back to offline mode:", err.message);
    return NextResponse.json({ text: null, error: "backend_unreachable" });
  }
}
