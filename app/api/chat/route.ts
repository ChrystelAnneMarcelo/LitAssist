import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question, papers, projectName } = await req.json();

    // 1. API KEY (Replace string or set env variable when given your team's API key)
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";

    // 2. CUSTOM TEAM API URL (Change when given team endpoint URL)
    const CUSTOM_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

    // Format selected paper context into RAG prompt
    const paperContext = papers && papers.length > 0
      ? papers.map((p: any, i: number) => `
Paper ${i + 1}:
Title: ${p.title}
Authors: ${p.authors} (${p.year})
Journal: ${p.journal || 'N/A'}
Tags: ${p.tags ? p.tags.join(', ') : 'N/A'}
Abstract: ${p.abstract || 'N/A'}
Methodology: ${p.methodology || 'N/A'}
Key Findings: ${p.keyFindings ? p.keyFindings.join('; ') : 'N/A'}
`).join("\n---\n")
      : "No specific papers selected. Analyze literature generally for project: " + (projectName || "RRL Analysis");

    // Only call external API if an API key is actually set!
    if (apiKey) {
      const prompt = `You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant.
Project: "${projectName || 'Literature Review'}".

Literature Context:
${paperContext}

User Question: "${question}"

Provide a detailed, highly academic, structured, and insightful response synthesizing the literature. Use clear markdown formatting.`;

      const response = await fetch(`${CUSTOM_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || data.text || data.message;
        if (text) {
          return NextResponse.json({ text });
        }
      }
    }

    // Fallback: Client-side Literature Synthesis Engine (runs when no API key is set)
    return NextResponse.json({ text: null });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json({ text: null, error: err.message });
  }
}
