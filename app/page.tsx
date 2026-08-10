"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";

export default function Home() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Fast-path: if an email is stored locally assume signed-in so login/signup flows land immediately.
    const localEmail = localStorage.getItem("litassist-email");
    if (localEmail) setAuthed(true);

    // Background check: verify server session (httpOnly cookie). If invalid, clear stored email and show landing.
    (async () => {
      try {
        const res = await fetch(`/api/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const body = await res.json();
          localStorage.setItem("litassist-email", body.email);
          setAuthed(true);
        } else {
          localStorage.removeItem("litassist-email");
          setAuthed(false);
        }
      } catch (e) {
        // network error — keep the local optimistic state if present, otherwise landing
        if (!localEmail) setAuthed(false);
      }
    })();
  }, []);

  if (authed === null) return null;

  if (authed) return <AppShell />;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--background)", fontFamily: "var(--font-sans)" }}>
      <div style={{ width: 640, padding: 36, borderRadius: 12, background: "var(--card)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
        <h1 style={{ margin: 0, color: "var(--foreground)", fontSize: "var(--text-2xl)", fontFamily: "var(--font-serif)" }}>LitAssist</h1>
        <p style={{ color: "var(--muted-foreground)", marginTop: 12, fontSize: "var(--text-xl)" }}>AI assistant for crafting Reviews of Related Literature (RRL). Analyze papers, synthesize themes, and draft sections faster.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <Link href="/signup"><button style={{ padding: "12px 18px", borderRadius: 10, background: "var(--primary)", color: "white", border: "none", cursor: "pointer", fontSize: "var(--text-lg)" }}>Sign up</button></Link>
          <Link href="/login"><button style={{ padding: "12px 18px", borderRadius: 10, background: "transparent", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", fontSize: "var(--text-lg)" }}>Log in</button></Link>
        </div>
      </div>
    </div>
  );
}
