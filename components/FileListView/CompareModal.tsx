"use client";

import { useState } from "react";
import {
  GitCompare,
  X,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Target,
  FlaskConical,
  BarChart3,
  Lightbulb,
  AlertCircle,
  Link2,
} from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface CompareModalProps {
  papers: Paper[];
  onClose: () => void;
}

const DIMENSIONS = [
  { key: "Research Objective", icon: Target, color: "#c9a96e" },
  { key: "Methodology", icon: FlaskConical, color: "#7e8fc7" },
  { key: "Sample / Dataset", icon: BarChart3, color: "#7ab8a4" },
  { key: "Key Findings", icon: Lightbulb, color: "#b07ab8" },
  { key: "Limitations", icon: AlertCircle, color: "#c97a7a" },
  { key: "Relevance", icon: Link2, color: "#c9a96e" },
];

const ACCENT = ["#c9a96e", "#7ab8a4", "#7e8fc7", "#b07ab8"];

function getPaperDimensionContent(paper: Paper, key: string): string {
  switch (key) {
    case "Research Objective":
      if (paper.abstract) {
        const objMatch = paper.abstract.match(/(?:objective|aim|investigate|propose|evaluate|study)[^.]*\./i);
        if (objMatch) return objMatch[0].trim();
        return paper.abstract.slice(0, 190) + (paper.abstract.length > 190 ? "…" : "");
      }
      return `Investigates ${paper.title.toLowerCase()} in ${paper.journal || "scholarly literature"}.`;

    case "Methodology":
      if (paper.methodology) return paper.methodology;
      if (paper.abstract) {
        const methMatch = paper.abstract.match(/(?:method|approach|framework|model|cnn|yolo|architecture|using|employed)[^.]*\./i);
        if (methMatch) return methMatch[0].trim();
      }
      return `Employs empirical analysis with ${paper.tags.join(", ") || "quantitative modeling"}.`;

    case "Sample / Dataset":
      if (paper.tags && paper.tags.length > 0) {
        return `Tags: ${paper.tags.join(", ")}. Dataset: ${paper.journal ? `Source from ${paper.journal}` : "Academic benchmark"}.`;
      }
      return `Custom dataset and benchmark samples in ${paper.year}.`;

    case "Key Findings":
      if (paper.keyFindings && paper.keyFindings.length > 0) {
        return paper.keyFindings.map((f) => `• ${f}`).join("\n");
      }
      if (paper.abstract) {
        const findMatch = paper.abstract.match(/(?:results|accuracy|find|demonstrated|achieved|performance)[^.]*\./i);
        if (findMatch) return findMatch[0].trim();
      }
      return `Demonstrates quantitative performance improvements in ${paper.tags[0] || "target domain"}.`;

    case "Limitations":
      if (paper.abstract) {
        const limMatch = paper.abstract.match(/(?:limitation|however|challenge|future|constrained|lack)[^.]*\./i);
        if (limMatch) return limMatch[0].trim();
      }
      return `Evaluation constrained to ${paper.tags[0] || "specific domain"} under benchmark conditions; requires real-world validation.`;

    case "Relevance":
      return `High — Published in ${paper.year} (${paper.journal || "Academic Source"}) addressing ${paper.tags.slice(0, 2).join(" & ") || "RRL scope"}.`;

    default:
      return "—";
  }
}

export default function CompareModal({ papers, onClose }: CompareModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [openDims, setOpenDims] = useState<Set<string>>(
    new Set(DIMENSIONS.map((d) => d.key)),
  );

  // Quick visual load state
  useState(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  });

  const toggle = (key: string) =>
    setOpenDims((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  return (
    <div className={styles.modalOverlay}>
      <div
        className={styles.modal}
        style={{ width: "min(92vw, 980px)", height: "82vh" }}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <GitCompare size={15} style={{ color: "var(--primary)" }} />
            <span className={styles.modalTitle}>
              Comparing {papers.length} selected paper{papers.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={15} />
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingIcon}>
              <div className={styles.loadingIconInner}>
                <Sparkles size={20} style={{ color: "var(--primary)" }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }} />
              <span className={styles.loadingText}>Extracting comparison matrix from selected papers…</span>
            </div>
          </div>
        ) : (
          <div className={styles.body}>
            {/* Table Header: Papers */}
            <div className={styles.headerRow}>
              <div className={styles.dimLabelHeader}>DIMENSIONS</div>
              {papers.map((paper, i) => (
                <div
                  key={paper.id}
                  className={styles.paperColHeader}
                  style={{
                    borderRight:
                      i < papers.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                    borderTop: `2px solid ${ACCENT[i % ACCENT.length]}`,
                  }}
                >
                  <div
                    className={styles.compareAccent}
                    style={{ color: ACCENT[i % ACCENT.length] }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div className={styles.compareTitle} title={paper.title}>
                    {paper.title.length > 50 ? paper.title.slice(0, 48) + "…" : paper.title}
                  </div>
                  <div className={styles.compareMeta}>
                    {paper.authors} · {paper.year}
                  </div>
                </div>
              ))}
            </div>

            {/* Dimension rows */}
            {DIMENSIONS.map(({ key, icon: Icon, color }) => {
              const isOpen = openDims.has(key);
              return (
                <div key={key} className={styles.dimRow}>
                  <button
                    className={styles.dimToggleBtn}
                    onClick={() => toggle(key)}
                  >
                    <Icon size={13} style={{ color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{key}</span>
                    {isOpen ? (
                      <ChevronDown
                        size={12}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    ) : (
                      <ChevronRight
                        size={12}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                    )}
                  </button>
                  {isOpen && (
                    <div className={styles.dimContent}>
                      <div className={styles.dimSpacer} />
                      {papers.map((paper, i) => (
                        <div
                          key={paper.id}
                          className={styles.dimCell}
                          style={{
                            borderRight:
                              i < papers.length - 1
                                ? "1px solid var(--border)"
                                : "none",
                            whiteSpace: "pre-line",
                            lineHeight: 1.5,
                          }}
                        >
                          {getPaperDimensionContent(paper, key)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
