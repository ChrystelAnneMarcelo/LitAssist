"use client";

import { useState } from "react";
import { X, BookOpen, Target, FlaskConical, Copy, Check, Calendar, User, Tag, BookMarked, ExternalLink, FileText, Award, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { Paper, Project } from "@/types";
import ScoringRubricModal from "@/components/ScoringRubricModal";
import styles from "./styles.module.css";

const SOURCE_LABELS: Record<string, string> = {
  doi: "DOI Lookup",
  pdf_upload: "Uploaded PDF",
  manual: "Manually Entered",
};

const PUBLICATION_TYPE_LABELS: Record<string, string> = {
  published: "Published",
  preprint: "Preprint",
  thesis: "Thesis or Dissertation",
  working_paper: "Working Paper",
  unpublished: "Unpublished",
};

interface PaperDetailModalProps {
  paper: Paper;
  onClose: () => void;
  project?: Project;
}

export default function PaperDetailModal({ paper, onClose, project }: PaperDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);

  const formatApaAuthors = (authors: string) => {
    if (!authors || authors === "Unknown Author") return "Unknown Author";
    if (authors.includes("et al.")) return authors;
    const names = authors.split(/,\s*/).map((n) => n.trim()).filter(Boolean);
    if (names.length > 2) {
      const first = names[0];
      const lastName = first.includes(" ") ? first.split(" ").pop() : first;
      return `${lastName}, et al.`;
    }
    return authors;
  };

  const formattedAuthors = formatApaAuthors(paper.authors);
  const cleanTitle = paper.title.endsWith(".") ? paper.title : `${paper.title}.`;

  const handleCopyCitation = () => {
    const citation = `${formattedAuthors} (${paper.year}). ${cleanTitle} ${paper.journal || ""}`.trim();
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setShowRubricModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--primary)",
                background: "rgba(201,169,110,0.08)",
                border: "1px solid rgba(201,169,110,0.25)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                padding: "4px 8px",
              }}
              title="View Paper Appraisal & Scoring Rubric"
            >
              <Award size={12} /> Rubric
            </button>
            <button onClick={onClose} className={styles.modalClose}>
              <X size={15} />
            </button>
          </div>
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

            {/* Source & Verification */}
            {(paper.source || paper.publicationType) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted-foreground)" }}>
                {paper.source && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <ShieldCheck size={12} style={{ color: "var(--primary)" }} />
                    Source: {SOURCE_LABELS[paper.source] || paper.source}
                  </span>
                )}
                {paper.publicationType && (
                  <span>{PUBLICATION_TYPE_LABELS[paper.publicationType] || paper.publicationType}</span>
                )}
              </div>
            )}
            {paper.contentCheck && !paper.contentCheck.passed && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "#e67e22", background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                <ShieldAlert size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{paper.contentCheck.reason}</span>
              </div>
            )}
            {(paper.publicationType === "published" || paper.publicationType === "preprint" || !paper.publicationType) && paper.verification && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  marginTop: 8,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: paper.verification.matched ? "var(--primary)" : "var(--muted-foreground)",
                }}
              >
                {paper.verification.matched ? <ShieldCheck size={12} style={{ flexShrink: 0, marginTop: 1 }} /> : <ShieldQuestion size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
                {paper.verification.matched ? (
                  <span>
                    Found in {paper.verification.source}
                    {paper.verification.url && (
                      <> — <a href={paper.verification.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>view record</a></>
                    )}
                  </span>
                ) : (
                  <span>
                    Not independently indexed
                    {paper.verification.similarity > 0 ? (
                      <> — closest result was only {Math.round(paper.verification.similarity * 100)}% similar, below the confidence threshold.</>
                    ) : (
                      <>.</>
                    )}
                  </span>
                )}
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
              {formattedAuthors} ({paper.year}). {cleanTitle}{" "}
              {paper.journal && <em style={{ fontStyle: "italic" }}>{paper.journal}</em>}
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

          {/* Online Links (DOI & PDF) */}
          {(paper.url || paper.doi || paper.pdfUrl) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(paper.url || paper.doi) && (
                <a
                  href={paper.url || `https://doi.org/${paper.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--radius)",
                    background: "rgba(201,169,110,0.1)",
                    border: "1px solid rgba(201,169,110,0.25)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "var(--primary)",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  <ExternalLink size={12} /> View Paper Online {paper.doi ? `(DOI: ${paper.doi})` : ""}
                </a>
              )}
              {paper.pdfUrl && (
                <a
                  href={paper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "var(--radius)",
                    background: "rgba(122,184,164,0.1)",
                    border: "1px solid rgba(122,184,164,0.25)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    color: "#7ab8a4",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  <FileText size={12} /> Direct Open-Access PDF
                </a>
              )}
            </div>
          )}

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-lg)",
              background: paper.fullText ? "rgba(122,184,164,0.08)" : "rgba(230,126,34,0.08)",
              border: `1px solid ${paper.fullText ? "rgba(122,184,164,0.25)" : "rgba(230,126,34,0.18)"}`,
              marginTop: 14,
            }}
          >
            <FileText size={14} style={{ color: paper.fullText ? "#7ab8a4" : "#e6a435" }} />
            <span style={{ fontSize: 12, color: paper.fullText ? "#1f4d3c" : "#7a4f15" }}>
              {paper.fullText
                ? "Full paper text is available for this paper. Analysis will use the paper content if needed."
                : "Full paper text is not available. Analysis will fall back to the abstract only."}
            </span>
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

      {showRubricModal && <ScoringRubricModal project={project} onClose={() => setShowRubricModal(false)} />}
    </div>
  );
}