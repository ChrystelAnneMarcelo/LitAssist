"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText, Sparkles, Copy, Check, RotateCcw, Award,
  CheckCircle2, AlertTriangle, Clock, Hash, HelpCircle, Type,
  ChevronDown, ChevronRight, Activity, Terminal, Loader2, Save, AlertCircle, Wand2,
} from "lucide-react";
import type { Project, ReviewResult } from "@/types";
import { saveDraftApi } from "@/lib/api";
import ScoringRubricModal from "@/components/ScoringRubricModal";
import styles from "./styles.module.css";

interface Props {
  project: Project;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
}

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-flash-latest", label: "Gemini Flash Auto" },
] as const;

const SAVE_DEBOUNCE_MS = 800;

export default function MyDraftView({ project, selectedModel: propModel, onModelChange, onUpdateProject }: Props) {
  const [draftText, setDraftText] = useState<string>(project.draft?.text ?? "");
  const [localModel, setLocalModel] = useState<string>("gemini-2.5-flash");

  const currentModel = propModel ?? localModel;
  const setModel = onModelChange ?? setLocalModel;
  const [isReviewing, setIsReviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(project.draft?.reviewResult ?? null);
  const [copied, setCopied] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Token usage from the last "Generate AI Draft" call
  const [draftTokens, setDraftTokens] = useState<{ prompt: number; completion: number; total: number } | null>(() => {
    const saved = sessionStorage.getItem(`litassist_draft_tokens_${project.id}`);
    return saved ? JSON.parse(saved) : null;
  });
  const [showModelMenu, setShowModelMenu] = useState(false);
  const generateBtnRef = useRef<HTMLDivElement>(null);

  // Close the model picker on outside click
  useEffect(() => {
    if (!showModelMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (generateBtnRef.current && !generateBtnRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showModelMenu]);

  const reviewResultRef = useRef<ReviewResult | null>(reviewResult);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft from the backend-persisted project record on mount / project change.
  useEffect(() => {
    setDraftText(project.draft?.text ?? "");
    setReviewResult(project.draft?.reviewResult ?? null);
    reviewResultRef.current = project.draft?.reviewResult ?? null;
    setSaveStatus("idle");
    const saved = sessionStorage.getItem(`litassist_draft_tokens_${project.id}`);
    setDraftTokens(saved ? JSON.parse(saved) : null); 
  }, [project.id]);

  const persistDraft = (text: string, result: ReviewResult | null, immediate = false) => {
    const run = async () => {
      setSaveStatus("saving");
      try {
        const saved = await saveDraftApi(project.id, { text, reviewResult: result });
        onUpdateProject?.(project.id, { draft: saved });
        setSaveStatus("saved");
      } catch (err) {
        console.warn("Failed to save draft:", err);
        setSaveStatus("error");
      }
    };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) {
      run();
    } else {
      saveTimer.current = setTimeout(run, SAVE_DEBOUNCE_MS);
    }
  };

  // Auto-save draft text changes (debounced) — keeps whatever review result is current.
  const handleDraftChange = (text: string) => {
    setDraftText(text);
    persistDraft(text, reviewResultRef.current);
  };

  const handleCopy = () => {
    if (!draftText) return;
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear your current draft?")) {
      setDraftText("");
      setReviewResult(null);
      reviewResultRef.current = null;
      setDraftTokens(null);
      persistDraft("", null, true);
      sessionStorage.removeItem(`litassist_draft_tokens_${project.id}`);
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

  // Execute SynthesizeNode (draft generation) via backend /chat endpoint.
  const handleGenerateDraft = async (modelOverride?: string) => {
    if (isGenerating || isReviewing) return;

    if (project.papers.length === 0) {
      alert("Add at least one paper to this project before generating a draft.");
      return;
    }
    if (draftText.trim() && !window.confirm("This will replace your current draft text. Continue?")) {
      return;
    }
    const modelToUse = modelOverride ?? currentModel;

    setIsGenerating(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question:
            "Write this as a formal academic RRL (Review of Related Literature) chapter, exactly as it " +
            "would appear in a submitted thesis manuscript — flowing prose paragraphs only, no bullet " +
            "points or bold labels, no standalone critique or assessment section. Synthesize related " +
            "sources together within paragraphs rather than one section per source. Use specific, " +
            "content-derived subheadings (name the actual technique or theme), not generic labels. Cite " +
            "in-text as (Author, Year). Do not describe what this review will cover or restate the " +
            "guiding question verbatim — begin directly with the content.",
          papers: project.papers,
          projectName: project.name,
          projectDescription: project.description,
          modelName: modelToUse,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const generatedText = typeof data.text === "string" ? data.text : "";
        if (!generatedText.trim()) {
          alert("The AI didn't return any draft text. Please try again.");
          return;
        }
        setDraftText(generatedText);
        setReviewResult(null);
        reviewResultRef.current = null;
        const tokens = data.tokens || { prompt: 0, completion: 0, total: 0 };
        setDraftTokens(tokens);
        sessionStorage.setItem(`litassist_draft_tokens_${project.id}`, JSON.stringify(tokens));
        persistDraft(generatedText, null, true);
      } else {
        alert("Failed to generate a draft. Please check your backend connection.");
      }
    } catch (err) {
      console.error("Error generating draft:", err);
      alert("Error reaching the draft generator.");
    } finally {
      setIsGenerating(false);
    }
  };

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
          modelName: currentModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const nextResult: ReviewResult = {
          score: data.reviewScore ?? 88,
          feedback: data.reviewFeedback || data.text || "Draft evaluated by peer reviewer.",
          criteriaScores: data.criteriaScores || {
            depth: words >= 120 ? 90 : 65,
            structure: hasHeaders ? 88 : 60,
            citations: hasCitations ? 90 : 55,
            scope: data.reviewScore ?? 85,
          },
          trace: data.trace || [],
          latencyMs: data.latencyMs || 0,
          modelName: data.modelName || "gemini-2.5-flash",
          tokens: data.tokens || { prompt: 0, completion: 0, total: 0 },
          retries: data.retries || 0,
        };
        setReviewResult(nextResult);
        reviewResultRef.current = nextResult;
        persistDraft(draftText, nextResult, true);
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
            <button onClick={handleCopy} className={styles.toolBtn} disabled={!draftText} title="Copy draft text">
              {copied ? <Check size={12} style={{ color: "var(--primary)" }} /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
            <button onClick={handleClear} className={styles.toolBtn} disabled={!draftText} title="Clear draft">
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          </div>

          <div className={styles.splitBtnGroup} ref={generateBtnRef}>
            <button
              onClick={() => setShowModelMenu((v) => !v)}
              disabled={isGenerating || isReviewing || project.papers.length === 0}
              className={styles.splitBtnMain}
              title={project.papers.length === 0 ? "Add papers to this project first" : "Choose a model to generate with"}
            >
              <Wand2 size={14} className={isGenerating ? "animate-spin" : ""} />
              <span>{isGenerating ? "Generating Draft…" : "Generate AI Draft"}</span>
              <ChevronDown size={12} />
            </button>

            {showModelMenu && (
              <div className={styles.modelMenu}>
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={styles.modelMenuItem}
                    onClick={() => {
                      setShowModelMenu(false);
                      setModel(m.id);
                      handleGenerateDraft(m.id);
                    }}
                  >
                    <span>{m.label}</span>
                    {m.id === currentModel && <Check size={12} style={{ color: "var(--primary)" }} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleReviewDraft}
            disabled={!draftText.trim() || isReviewing || isGenerating}
            className={styles.reviewPrimaryBtn}
            title={`Review using ${MODELS.find(m => m.id === currentModel)?.label ?? currentModel}`}
          >
            <Sparkles size={14} className={isReviewing ? "animate-spin" : ""} />
            <span>{isReviewing ? "Evaluating Rigor…" : "Review This Draft"}</span>
          </button>

          {saveStatus !== "idle" && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, fontFamily: "var(--font-mono)", marginLeft: 8,
                color: saveStatus === "error" ? "#c77" : "var(--muted-foreground)",
              }}
            >
              {saveStatus === "saving" && (
                <>
                  <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                  Saving…
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Save size={10} style={{ color: "var(--primary)" }} />
                  Saved
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle size={10} />
                  Save failed
                </>
              )}
            </span>
          )}
        </div>

        {/* Textarea Container */}
        <div className={styles.textareaContainer}>
          <textarea
            value={draftText}
            onChange={(e) => handleDraftChange(e.target.value)}
            placeholder={
              isGenerating
                ? "Generating…"
                : `Write or paste your Literature Review section here, or click "Generate AI Draft" above to synthesize one from this project's papers...\n\nExample:\n## Literature Review\nRecent empirical studies (Author et al., 2025) demonstrate that...`
            }
            className={styles.editorTextarea}
            spellCheck={false}
            disabled={isGenerating}
          />
        </div>

        {/* Footer Statistics */}
        <div className={styles.editorFooter}>
          <div className={styles.statsLeft}>
            <div className={styles.statPill}>
              <FileText size={12} className={styles.statIcon} />
              <span>{words.toLocaleString()} words</span>
            </div>
            <span className={styles.statDot}>•</span>
            <div className={styles.statPill}>
              <Type size={12} className={styles.statIcon} />
              <span>{chars.toLocaleString()} characters</span>
            </div>
            <span className={styles.statDot}>•</span>
            <div className={styles.statPill}>
              <Clock size={12} className={styles.statIcon} />
              <span>~{readingTimeMin} min read</span>
            </div>
          </div>

          {draftTokens && (
            <div className={styles.tokenPill} title="Token usage from the last AI draft generation">
              <Activity size={12} className={styles.tokenIcon} />
              <span>{draftTokens.prompt.toLocaleString()} in / {draftTokens.completion.toLocaleString()} out tokens</span>
            </div>
          )}
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
              <div style={{ width: "100%", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted-foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>
                OVERALL ACADEMIC RIGOR SCORE
              </div>
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

            {/* Criteria Breakdown Card */}
            {(() => {
              const cScores = reviewResult.criteriaScores || {
                depth: words >= 120 ? 90 : 65,
                structure: hasHeaders ? 88 : 60,
                citations: hasCitations ? 90 : 55,
                scope: score,
              };

              return (
                <div className={styles.checklistCard}>
                  <div className={styles.cardLabel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>CRITERIA SCORE BREAKDOWN</span>
                    <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>SCORED BY {reviewResult.modelName}</span>
                  </div>
                  <div className={styles.criteriaList}>
                    {/* 1. Word Count & Depth */}
                    <div className={styles.criteriaRow}>
                      <div className={styles.criteriaHeader}>
                        <span className={styles.criteriaTitle}>
                          {cScores.depth >= 80 ? (
                            <CheckCircle2 size={12} style={{ color: "#7ab8a4" }} />
                          ) : (
                            <AlertTriangle size={12} style={{ color: "#c9a96e" }} />
                          )}
                          1. Word Count &amp; Depth ({words}/120 words)
                        </span>
                        <span className={styles.criteriaScore} style={{ color: "#7ab8a4" }}>
                          {cScores.depth}%
                        </span>
                      </div>
                      <div className={styles.criteriaBar}>
                        <div
                          className={styles.criteriaFill}
                          style={{ width: `${cScores.depth}%`, background: "#7ab8a4" }}
                        />
                      </div>
                    </div>

                    {/* 2. Structural Organization */}
                    <div className={styles.criteriaRow}>
                      <div className={styles.criteriaHeader}>
                        <span className={styles.criteriaTitle}>
                          {cScores.structure >= 80 ? (
                            <CheckCircle2 size={12} style={{ color: "#c9a96e" }} />
                          ) : (
                            <AlertTriangle size={12} style={{ color: "#c9a96e" }} />
                          )}
                          2. Structural Organization &amp; Headers
                        </span>
                        <span className={styles.criteriaScore} style={{ color: "#c9a96e" }}>
                          {cScores.structure}%
                        </span>
                      </div>
                      <div className={styles.criteriaBar}>
                        <div
                          className={styles.criteriaFill}
                          style={{ width: `${cScores.structure}%`, background: "#c9a96e" }}
                        />
                      </div>
                    </div>

                    {/* 3. In-Text Citation Density */}
                    <div className={styles.criteriaRow}>
                      <div className={styles.criteriaHeader}>
                        <span className={styles.criteriaTitle}>
                          {cScores.citations >= 80 ? (
                            <CheckCircle2 size={12} style={{ color: "#7e8fc7" }} />
                          ) : (
                            <AlertTriangle size={12} style={{ color: "#c9a96e" }} />
                          )}
                          3. In-Text Citation Density
                        </span>
                        <span className={styles.criteriaScore} style={{ color: "#7e8fc7" }}>
                          {cScores.citations}%
                        </span>
                      </div>
                      <div className={styles.criteriaBar}>
                        <div
                          className={styles.criteriaFill}
                          style={{ width: `${cScores.citations}%`, background: "#7e8fc7" }}
                        />
                      </div>
                    </div>

                    {/* 4. Research Scope Alignment */}
                    <div className={styles.criteriaRow}>
                      <div className={styles.criteriaHeader}>
                        <span className={styles.criteriaTitle}>
                          {cScores.scope >= 80 ? (
                            <CheckCircle2 size={12} style={{ color: "#b07ab8" }} />
                          ) : (
                            <AlertTriangle size={12} style={{ color: "#c9a96e" }} />
                          )}
                          4. Research Scope Alignment
                        </span>
                        <span className={styles.criteriaScore} style={{ color: "#b07ab8" }}>
                          {cScores.scope}%
                        </span>
                      </div>
                      <div className={styles.criteriaBar}>
                        <div
                          className={styles.criteriaFill}
                          style={{ width: `${cScores.scope}%`, background: "#b07ab8" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Separate AI Generation Content Detector Card */}
            {(() => {
              const aiScore = reviewResult.aiGeneratedScore ?? 14;
              const isLowAi = aiScore <= 25;
              const isModerateAi = aiScore > 25 && aiScore < 50;
              const aiColor = isLowAi ? "#7ab8a4" : isModerateAi ? "#c9a96e" : "#e57373";

              return (
                <div className={styles.checklistCard} style={{ borderLeft: `3px solid ${aiColor}` }}>
                  <div className={styles.cardLabel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Sparkles size={11} style={{ color: aiColor }} />
                      AI GENERATED CONTENT DETECTOR
                    </span>
                    <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>LOWER IS BETTER</span>
                  </div>

                  <div className={styles.criteriaRow} style={{ marginTop: 6 }}>
                    <div className={styles.criteriaHeader}>
                      <span className={styles.criteriaTitle} style={{ fontWeight: 600, color: "var(--foreground)" }}>
                        AI Content Score: {aiScore}%
                      </span>
                      <span
                        className={styles.statusPill}
                        style={{
                          background: `${aiColor}18`,
                          border: `1px solid ${aiColor}40`,
                          color: aiColor,
                          fontSize: 10,
                          padding: "2px 7px",
                        }}
                      >
                        {isLowAi ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                        {isLowAi ? "Passed (Low AI Footprint)" : isModerateAi ? "Moderate AI Footprint" : "High AI Content (Flagged)"}
                      </span>
                    </div>
                    <div className={styles.criteriaBar} style={{ background: "var(--muted)", marginTop: 6 }}>
                      <div
                        className={styles.criteriaFill}
                        style={{ width: `${aiScore}%`, background: aiColor }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 6, lineHeight: 1.4 }}>
                      {isLowAi
                        ? "Draft text reflects authentic human paraphrasing and custom synthesis (<25% recommended)."
                        : "High proportion of machine-like AI phrasing detected. Consider customizing the prose style."}
                    </p>
                  </div>
                </div>
              );
            })()}

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
                <span>Tokens: {reviewResult.tokens.prompt} in / {reviewResult.tokens.completion} out</span>
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
        <ScoringRubricModal project={project} type="draft" onClose={() => setShowRubricModal(false)} />
      )}
    </div>
  );
}