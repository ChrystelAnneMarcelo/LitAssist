import { NextResponse } from "next/server";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const res = await fetch(`${BACKEND_URL}/parse-pdf`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.warn("PDF parser endpoint unreachable:", err);
    return NextResponse.json({ error: err.message || "Failed to parse PDF file" }, { status: 500 });
  }
}
