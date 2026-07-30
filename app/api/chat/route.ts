import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { question, papers, projectName } = await req.json();

    // 1. API KEY
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";

    // 2.  CUSTOM TEAM API URL (Change pag meron na api)
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

    // Send payload to API when API Key or Custom URL is active
    if (apiKey || CUSTOM_API_URL) {
      const prompt = `You are LitAssist, an expert AI Literature Review (RRL) Analysis Assistant.
Project: "${projectName || 'Literature Review'}".

Literature Context:
${paperContext}

User Question: "${question}"

Provide a detailed, highly academic, structured, and insightful response synthesizing the literature. Use clear markdown formatting.`;

      // 📡 CALL YOUR API ENDPOINT HERE
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

    // Fallback: Client-side Literature Synthesis Engine (if API returns null or not configured)
    return NextResponse.json({ text: null });
  } catch (err: any) {
    console.error("Chat API error:", err);
    return NextResponse.json({ text: null, error: err.message });
  }
}
