"use client";

import { useState } from "react";
import { signup } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!agree) return setError("You must agree to the terms and conditions.");
    try {
      await signup(email, password);
      router.push("/app");
    } catch (err: any) {
      setError(err?.message || "Signup failed");
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "var(--font-sans)" }}>
      <form onSubmit={handleSubmit} style={{ width: 520, padding: 28, borderRadius: 12, background: "var(--card)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-2xl)", fontFamily: "var(--font-serif)" }}>Create an account</h2>
        <label style={{ display: "block", marginTop: 14, fontSize: "var(--text-lg)" }}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ width: "100%", padding: 10, marginTop: 8, fontSize: "var(--text-lg)" }} />
        <label style={{ display: "block", marginTop: 14, fontSize: "var(--text-lg)" }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={6} style={{ width: "100%", padding: 10, marginTop: 8, fontSize: "var(--text-lg)" }} />

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: "var(--text-base)" }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{" "}
            I understand that (1) inaccessible papers won't be included and (2) the chatbot is powered by an AI tool.
          </label>
        </div>

        {error && <div style={{ color: "var(--destructive)", marginTop: 10 }}>{error}</div>}

        <button type="submit" style={{ marginTop: 18, padding: "12px 16px", borderRadius: 10, background: "var(--primary)", color: "white", border: "none", fontSize: "var(--text-lg)" }}>Create account</button>
      </form>
    </div>
  );
}
