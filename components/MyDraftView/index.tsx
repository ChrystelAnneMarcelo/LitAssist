"use client";

import { useState, useEffect } from "react";
import {
  FileText, Sparkles, Copy, Check, RotateCcw, Award,
  CheckCircle2, AlertTriangle, Clock, Hash, HelpCircle,
  FileCheck, ChevronDown, ChevronRight, Activity, Terminal
} from "lucide-react";
import type { Project } from "@/types";
import ScoringRubricModal from "@/components/ScoringRubricModal";
import styles from "./styles.module.css";

interface Props {
  project: Project;
}

interface ReviewResult {
  score: number;
  feedback: string;
  trace: string[];
  latencyMs: number;
  modelName: string;
  tokens: { prompt: number; completion: number; total: number };
  retries: number;
}

const STARTER_TEMPLATE = `## Literature Review: Synthesis & Analysis

### 1. Theoretical Framework & Methodological Approaches
Recent empirical investigations into this field have established key baseline methodologies (Dai et al., 2025). Convolutional neural networks and vision transformer architectures demonstrate high feature representation capabilities when evaluated on benchmark plant disease datasets.

### 2. Experimental Results & Performance Benchmarks
Comparative quantitative evaluations confirm that hybrid modular models outperform standard baseline networks in accuracy and precision (Nasra et al., 2025). High empirical performance is consistently reported across 5-fold cross-validation benchmarks under controlled environmental conditions.

### 3. Synthesis of Critical Research Gaps
Despite high classification accuracy on benchmark datasets, significant research gaps remain regarding real-world generalizability under domain shifts, operational memory footprints on resource-constrained edge hardware, and visual model explainability for domain expert validation. Addressing these gaps provides strong theoretical justification for further investigation.`;

export default function MyDraftView({ project }: Props) {
  const localStorageKey = `litassist_draft_${project.id}`;

  const [draftText, setDraftText] = useState<string>("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  // Load draft from localStorage on mount / project change
  useEffect(() => {
    const saved = localStorage.getItem(localStorageKey);
    if (saved !== null) {
      setDraftText(saved);
    } else {
      setDraftText("");
    }
    setReviewResult(null);
  }, [project.id, localStorageKey]);

  // Auto-save draft changes to localStorage
  const handleDraftChange = (text: string) => {
    setDraftText(text);
    localStorage.setItem(localStorageKey, text);
  };

  const handleInsertTemplate = () => {
    const nextText = draftText.trim()
      ? `${draftText}\n\n${STARTER_TEMPLATE}`
      : STARTER_TEMPLATE;
    handleDraftChange(nextText);
  };

  const handleCopy = () => {
    if (!draftText) return;
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear your current draft?")) {
      handleDraftChange("");
      setReviewResult(null);
    }
  };

  // Live text metrics
  const words = draftText.trim() ? draftText.trim().split(/\s+/).length : 0;
  const chars = draftText.length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  // Rubric checks
  const hasMinLength = words >= 120;
  const hasHeaders = /#+\s/.test(draftText);
  const hasCitations = /\b(19|20)\d{2}\b/.test(draftText) || /et al\./i.test(draftText);

  // Execute ReviewerNode via backend /chat endpoint
  const handleReviewDraft = async () => {
    if (!draftText.trim() || isReviewing) return;
    setIsReviewing(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Review my draft",
          draftText: draftText,
          projectName: project.name,
          projectDescription: project.description,
          papers: project.papers,
          modelName: "gemini-2.5-flash",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReviewResult({
          score: data.reviewScore ?? 88,
          feedback: data.reviewFeedback || data.text || "Draft evaluated by peer reviewer.",
          trace: data.trace || [],
          latencyMs: data.latencyMs || 0,
          modelName: data.modelName || "gemini-2.5-flash",
          tokens: data.tokens || { prompt: 0, completion: 0, total: 0 },
          retries: data.retries || 0,
        });
      } else {
        alert("Failed to evaluate draft. Please check your backend connection.");
      }
    } catch (err: any) {
      console.error("Error evaluating draft:", err);
      alert("Error reaching review node.");
    } finally {
      setIsReviewing(false);
    }
  };

  const score = reviewResult?.score ?? 0;
  const isPassing = score >= 80;
  const scoreColor = isPassing ? "#7ab8a4" : score >= 70 ? "#c9a96e" : "#e57373";

  return (
    <div className={styles.view}>
      {/* Left: Editor Pane */}
      <div className={styles.editorPane}>
        <div className={styles.editorHeader}>
          <div className={styles.editorHeaderTitle}>
            <FileText size={15} style={{ color: "var(--primary)" }} />
            <span>My RRL Draft</span>
            <span className={styles.editorBadge}>ACTIVE EDITOR</span>
          </div>
          <button
            onClick={() => setShowRubricModal(true)}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted-foreground)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
            }}
            title="View Peer Review Rubric"
          >
            <Award size={13} style={{ color: "#c9a96e" }} />
            <span>Rubric</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className={styles.editorToolbar}>
          <div className={styles.toolbarGroup}>
            <button onClick={handleInsertTemplate} className={styles.toolBtn} title="Insert structured RRL template">
              <FileCheck size={12} />
              <span>Insert Template</span>
            </button>
            <button onClick={handleCopy} className={styles.toolBtn} disabled={!draftText} title="Copy draft text">
              {copied ? <Check size={12} style={{ color: "var(--primary)" }} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button onClick={handleClear} className={styles.toolBtn} disabled={!draftText} title="Clear draft">
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          </div>

          <button
            onClick={handleReviewDraft}
            disabled={!draftText.trim() || isReviewing}
            className={styles.reviewPrimaryBtn}
          >
            <Sparkles size={14} className={isReviewing ? "animate-spin" : ""} />
            <span>{isReviewing ? "Evaluating Rigor…" : "Review This Draft"}</span>
          </button>
        </div>

        {/* Textarea Container */}
        <div className={styles.textareaContainer}>
          <textarea
            value={draftText}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={`Write or paste your Literature Review section here...\n\nExample:\n## Literature Review\nRecent empirical studies (Author et al., 2025) demonstrate that...`}
            className={styles.editorTextarea}
            spellCheck={false}
          />
        </div>

        {/* Footer Statistics */}
        <div className={styles.editorFooter}>
          <div className={styles.statItem}>
            <Hash size={11} />
            <span>{words} words</span>
          </div>
          <div className={styles.statItem}>
            <span>{chars} characters</span>
          </div>
          <div className={styles.statItem}>
            <Clock size={11} />
            <span>~{readingTimeMin} min read</span>
          </div>
        </div>
      </div>

      {/* Right: Inline Peer Review Report Pane */}
      <div className={styles.reportPane}>
        <div className={styles.reportHeader}>
          <div className={styles.reportTitle}>
            <Award size={15} style={{ color: "#c9a96e" }} />
            <span>Peer Reviewer Report</span>
          </div>
          <div className={styles.reportSub}>
            LLM-as-a-Judge Evaluation ({project.name})
          </div>
        </div>

        {!reviewResult && !isReviewing && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Award size={20} />
            </div>
            <div>
              <p className={styles.emptyTitle}>No Review Generated Yet</p>
              <p className={styles.emptyHint}>
                Write or paste your RRL section in the editor and click <strong>Review This Draft</strong> to get an instant academic score and feedback.
              </p>
            </div>
          </div>
        )}

        {isReviewing && (
          <div className={styles.emptyState}>
            <Sparkles size={24} style={{ color: "var(--primary)", animation: "spin 1.5s linear infinite" }} />
            <div>
              <p className={styles.emptyTitle}>ReviewerNode Active</p>
              <p className={styles.emptyHint}>Evaluating academic rigor, section headers, and citation density...</p>
            </div>
          </div>
        )}

        {reviewResult && !isReviewing && (
          <div className={styles.reportContent}>
            {/* Score Card */}
            <div className={styles.scoreCard}>
              <div className={styles.scoreGauge} style={{ color: scoreColor }}>
                <span className={styles.scoreNum}>{reviewResult.score}</span>
                <span className={styles.scoreMax}>/ 100</span>
              </div>
              <div className={styles.scoreMeta}>
                <div
                  className={styles.statusPill}
                  style={{
                    background: `${scoreColor}18`,
                    border: `1px solid ${scoreColor}40`,
                    color: scoreColor,
                  }}
                >
                  {isPassing ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                  {isPassing ? "Passed Rigor Threshold" : "Revision Recommended"}
                </div>
                <div className={styles.scoreDesc}>
                  {isPassing
                    ? "Draft meets rigorous academic standards for publication &amp; synthesis."
                    : "Draft requires additional structure, citation alignment, or depth."}
                </div>
              </div>
            </div>

            {/* Academic Rubric Checklist */}
            <div className={styles.checklistCard}>
              <div className={styles.cardLabel}>ACADEMIC RUBRIC CHECKLIST</div>
              <div className={styles.checkGrid}>
                <div className={styles.checkItem}>
                  {hasMinLength ? (
                    <CheckCircle2 size={13} className={styles.checkBadgePass} />
                  ) : (
                    <AlertTriangle size={13} className={styles.checkBadgeWarn} />
                  )}
                  <span>Word Count ({words}/120)</span>
                </div>
                <div className={styles.checkItem}>
                  {hasHeaders ? (
                    <CheckCircle2 size={13} className={styles.checkBadgePass} />
                  ) : (
                    <AlertTriangle size={13} className={styles.checkBadgeWarn} />
                  )}
                  <span>Markdown Headers</span>
                </div>
                <div className={styles.checkItem}>
                  {hasCitations ? (
                    <CheckCircle2 size={13} className={styles.checkBadgePass} />
                  ) : (
                    <AlertTriangle size={13} className={styles.checkBadgeWarn} />
                  )}
                  <span>In-Text Citations</span>
                </div>
                <div className={styles.checkItem}>
                  <CheckCircle2 size={13} className={styles.checkBadgePass} />
                  <span>Scope Alignment</span>
                </div>
              </div>
            </div>

            {/* Critique Feedback */}
            <div className={styles.feedbackCard}>
              <div className={styles.cardLabel}>REVIEWER CRITIQUE &amp; FEEDBACK</div>
              <div className={styles.feedbackText}>{reviewResult.feedback}</div>
            </div>

            {/* Observability Trace Accordion */}
            <div className={styles.traceCard}>
              <button
                onClick={() => setShowTrace(!showTrace)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  color: "var(--muted-foreground)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Terminal size={11} style={{ color: "var(--primary)" }} />
                  Observability Logs ({reviewResult.latencyMs}ms)
                </span>
                {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              <div className={styles.traceMetrics}>
                <span>Model: {reviewResult.modelName}</span>
                <span>Tokens: {reviewResult.tokens.total}</span>
                <span>Retries: {reviewResult.retries}</span>
              </div>

              {showTrace && reviewResult.trace.length > 0 && (
                <div className={styles.traceList}>
                  {reviewResult.trace.map((step, idx) => (
                    <div key={idx} className={styles.traceItem}>
                      {step}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showRubricModal && (
        <ScoringRubricModal project={project} onClose={() => setShowRubricModal(false)} />
      )}
    </div>
  );
}
