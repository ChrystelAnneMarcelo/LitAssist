import { NextResponse } from "next/server";
import { ChatInputSchema } from "@/lib/agent/schemas";
import { runLitAssistGraph } from "@/lib/agent/graph";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ─── Pydantic-style input validation (Zod Guardrail) ───────
    const parsed = ChatInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { text: null, error: "Invalid input: " + parsed.error.message },
        { status: 400 }
      );
    }

    const { question, papers, projectName } = parsed.data;

    // ─── Run LangGraph 5-Node Agent Pipeline ──────────────────
    //   PlannerNode → SearchToolNode → ExtractNode → SynthesizeNode → ReviewerNode
    const result = await runLitAssistGraph({ question, papers, projectName });

    if (result.usedFallback) {
      // No API key — signal frontend to use offline synthesis engine
      return NextResponse.json({
        text: null,
        trace: result.trace,
        tokens: result.tokens,
        latencyMs: result.latencyMs,
        reviewScore: null,
        retries: result.retries,
      });
    }

    return NextResponse.json({
      text: result.text,
      trace: result.trace,
      tokens: result.tokens,
      latencyMs: result.latencyMs,
      reviewScore: result.reviewScore,
      retries: result.retries,
    });

  } catch (err: any) {
    console.error("LangGraph agent error:", err);
    return NextResponse.json({ text: null, error: err.message });
  }
}
