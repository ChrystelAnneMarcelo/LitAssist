"use client";

import React from "react";

interface Props {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SignOutModal({ visible, onConfirm, onCancel }: Props) {
  if (!visible) return null;

  return (
    <div style={{ position: "fixed", left: 24, bottom: 80, zIndex: 9999, animation: "fadeIn 160ms ease" }}>
      <div style={{ minWidth: 260, padding: 14, borderRadius: 10, background: "var(--card)", color: "var(--card-foreground)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Sign out?</div>
        <div style={{ fontSize: "0.9rem", color: "var(--muted-foreground)" }}>You will be returned to the landing page.</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button onClick={onCancel} style={{ padding: "8px 10px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)" }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--destructive)", color: "var(--destructive-foreground)", border: "none" }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
