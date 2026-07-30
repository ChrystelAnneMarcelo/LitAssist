"use client";

import { useState } from "react";
import { X, BookOpen, Target, FlaskConical, Copy, Check, Calendar, User, Tag, BookMarked } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface PaperDetailModalProps {
  paper: Paper;
  onClose: () => void;
}

export default function PaperDetailModal({ paper, onClose }: PaperDetailModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCitation = () => {
    const citation = `${paper.authors} (${paper.year}). ${paper.title}. ${paper.journal ? `${paper.journal}.` : ""}`;
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ width: "min(92vw, 680px)", maxHeight: "85vh", overflowY: "auto" }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <BookMarked size={16} style={{ color: "var(--primary)" }} />
            <span className={styles.modalTitle}>Paper Details</span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody} style={{ gap: 16 }}>
          {/* Title & Metadata */}
          <div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 17, color: "var(--foreground)", lineHeight: 1.4 }}>
              {paper.title}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, fontSize: 12, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <User size={12} style={{ color: "var(--primary)" }} /> {paper.authors}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Calendar size={12} style={{ color: "var(--primary)" }} /> {paper.year}
              </span>
              {paper.journal && <span>Journal: {paper.journal}</span>}
            </div>

            {/* Tags */}
            {paper.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {paper.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono)",
                      padding: "3px 8px",
                      borderRadius: 9999,
                      background: "rgba(201,169,110,0.08)",
                      color: "var(--primary)",
                      border: "1px solid rgba(201,169,110,0.2)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Citation Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderRadius: "var(--radius)",
              background: "var(--input-background)",
              border: "1px solid var(--border)",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--foreground)", flex: 1 }}>
              <span style={{ color: "var(--muted-foreground)" }}>APA Citation: </span>
              {paper.authors} ({paper.year}). {paper.title}. {paper.journal}
            </div>
            <button
              onClick={handleCopyCitation}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--muted)",
                fontSize: 11,
                color: "var(--muted-foreground)",
                flexShrink: 0,
              }}
            >
              {copied ? <Check size={11} style={{ color: "var(--primary)" }} /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy APA"}
            </button>
          </div>

          {/* Abstract */}
          {paper.abstract && (
            <div style={{ background: "var(--card)", padding: 14, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                <BookOpen size={14} style={{ color: "#7ab8a4" }} /> Abstract
              </div>
              <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.7 }}>
                {paper.abstract}
              </p>
            </div>
          )}

          {/* Methodology */}
          {paper.methodology && (
            <div style={{ background: "var(--card)", padding: 14, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                <FlaskConical size={14} style={{ color: "#7e8fc7" }} /> Methodology
              </div>
              <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.7 }}>
                {paper.methodology}
              </p>
            </div>
          )}

          {/* Key Findings */}
          {paper.keyFindings && paper.keyFindings.length > 0 && (
            <div style={{ background: "var(--card)", padding: 14, borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 500, color: "var(--foreground)" }}>
                <Target size={14} style={{ color: "#c9a96e" }} /> Key Findings
              </div>
              <ul style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", padding: 0 }}>
                {paper.keyFindings.map((f, i) => (
                  <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
                    <span style={{ color: "var(--primary)", fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0 }}>
                      0{i + 1}.
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary}>Close</button>
        </div>
      </div>
    </div>
  );
}
