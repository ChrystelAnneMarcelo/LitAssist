"use client";

import { X, Award, CheckCircle2, Sliders, Info, FileText, Target, Hash } from "lucide-react";
import type { Project } from "@/types";
import styles from "./styles.module.css";

interface ScoringRubricModalProps {
  onClose: () => void;
  project?: Project | null;
  projectName?: string;
  projectDescription?: string;
  type?: "paper" | "draft";
}

export default function ScoringRubricModal({
  onClose,
  project,
  projectName,
  projectDescription,
  type = "paper",
}: ScoringRubricModalProps) {
  const activeName = projectName || project?.name || "Your Active Project";
  const activeDesc = projectDescription || project?.description || "";

  const isDraft = type === "draft";

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <Award size={18} style={{ color: "var(--primary)" }} />
            <div>
              <h2 className={styles.modalTitle}>
                {isDraft ? "Peer Review RRL Draft Rubric" : "Paper Appraisal & Scoring Rubric"}
              </h2>
              <p className={styles.modalSubtitle}>
                {isDraft
                  ? `Evaluation criteria for your draft section in "${activeName}"`
                  : `Evaluation framework for "${activeName}"`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className={styles.modalBody}>
          {/* Intro Box */}
          <div className={styles.introBox}>
            <Info size={15} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className={styles.introText}>
                {isDraft
                  ? `Your RRL draft is evaluated by LitAssist's ReviewerNode for structural rigor, citation density, and scope alignment against "${activeName}"${activeDesc ? ` (${activeDesc})` : ""}.`
                  : `Every paper in LitAssist is evaluated against the research scope defined for "${activeName}"${activeDesc ? ` (${activeDesc})` : ""}.`}
              </p>
              <p className={styles.introSubtext}>
                {isDraft
                  ? "Scores ≥80 pass academic publication standards. Scores <80 highlight areas needing expansion or structural revision."
                  : "LitAssist evaluates paper alignment, methodological quality, and synthesis contribution across all academic disciplines."}
              </p>
            </div>
          </div>

          {/* Criteria Cards */}
          {isDraft ? (
            /* Draft Peer Review Rubric Cards */
            <div className={styles.rubricGrid}>
              {/* Draft Criteria 1 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(122,184,164,0.12)", color: "#7ab8a4" }}>
                    <Hash size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>1. Word Count &amp; Depth Adequacy</h3>
                    <span className={styles.weightBadge}>Weight: 20%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Assesses whether the draft provides sufficient narrative length and detailed argument progression for an RRL chapter.
                </p>
                <ul className={styles.tierList}>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#7ab8a4", borderColor: "#7ab8a450" }}>≥120 Words (Pass)</span>
                    <span>Provides adequate narrative depth, synthesis context, and empirical background.</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#c9a96e", borderColor: "#c9a96e50" }}>&lt;120 Words (Needs Work)</span>
                    <span>Draft is too brief; requires additional empirical detail and synthesis expansion.</span>
                  </li>
                </ul>
              </div>

              {/* Draft Criteria 2 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(201,169,110,0.12)", color: "#c9a96e" }}>
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>2. Structural Organization &amp; Section Headers</h3>
                    <span className={styles.weightBadge}>Weight: 25%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Evaluates formatting, paragraph structure, and use of hierarchical Markdown section headings (`#`, `##`, `###`).
                </p>
                <ul className={styles.tierList}>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#7ab8a4", borderColor: "#7ab8a450" }}>Pass</span>
                    <span>Clear section headings delineating theoretical framework, findings, and research gap.</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#c9a96e", borderColor: "#c9a96e50" }}>Revision Needed</span>
                    <span>Unstructured paragraph block lacking explicit headings or section divisions.</span>
                  </li>
                </ul>
              </div>

              {/* Draft Criteria 3 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(126,143,199,0.12)", color: "#7e8fc7" }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>3. In-Text Citation Density &amp; Integrity</h3>
                    <span className={styles.weightBadge}>Weight: 30%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Checks for frequent in-text author/year citations (`(Author et al., 2025)`) grounding empirical claims in academic literature.
                </p>
                <ul className={styles.tierList}>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#7ab8a4", borderColor: "#7ab8a450" }}>Pass</span>
                    <span>Frequent, properly formatted in-text citations anchoring major claims.</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#c9a96e", borderColor: "#c9a96e50" }}>Revision Needed</span>
                    <span>Claims made without literature backing or missing year/author citations.</span>
                  </li>
                </ul>
              </div>

              {/* Draft Criteria 4 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(176,122,184,0.12)", color: "#b07ab8" }}>
                    <Target size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>4. Research Scope Alignment</h3>
                    <span className={styles.weightBadge}>Weight: 25%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Evaluates how directly the RRL draft connects cited studies to the specific scope defined for <strong>"{activeName}"</strong>.
                </p>
                <ul className={styles.tierList}>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#7ab8a4", borderColor: "#7ab8a450" }}>Pass</span>
                    <span>Synthesizes literature directly relevant to the project's technical domain and core questions.</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#b07ab8", borderColor: "#b07ab850" }}>Revision Needed</span>
                    <span>Generic narrative disconnected from the active research scope parameters.</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* Paper Appraisal Rubric Cards (Default) */
            <div className={styles.rubricGrid}>
              {/* Paper Criteria 1 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(201,169,110,0.12)", color: "#c9a96e" }}>
                    <Award size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>1. Topic Relevance Score (0–100%)</h3>
                    <span className={styles.weightBadge}>Alignment Weight: 40%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Evaluates how directly the paper’s research questions, core focus, and findings align with <strong>"{activeName}"</strong>.
                </p>
                <ul className={styles.tierList}>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#7ab8a4", borderColor: "#7ab8a450" }}>80–100% High</span>
                    <span>Directly addresses the primary research questions, subject matter, and scope of "{activeName}".</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#c9a96e", borderColor: "#c9a96e50" }}>50–79% Moderate</span>
                    <span>Addresses the broader academic field or related methods, but does not specifically target "{activeName}".</span>
                  </li>
                  <li>
                    <span className={styles.tierTag} style={{ color: "#b07ab8", borderColor: "#b07ab850" }}>0–49% Low</span>
                    <span>Tangentially related or outside the defined research parameters.</span>
                  </li>
                </ul>
              </div>

              {/* Paper Criteria 2 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(122,184,164,0.12)", color: "#7ab8a4" }}>
                    <Sliders size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>2. Methodological Rigor Score (0–100%)</h3>
                    <span className={styles.weightBadge}>Rigor Weight: 60%</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Assesses the quality, soundness, and analytical validity of the paper's research design, evidence, and execution.
                </p>
                <ul className={styles.bulletList}>
                  <li><strong>Data &amp; Evidence Quality:</strong> Relevance, integrity, sample adequacy, and source reliability of the data, primary sources, or evidence analyzed.</li>
                  <li><strong>Research &amp; Conceptual Design:</strong> Clarity, appropriateness, and logical soundness of the analytical framework, methodology, or reasoning.</li>
                  <li><strong>Validation &amp; Argumentation:</strong> Depth of critical analysis, robustness of validation procedures, and effectiveness in addressing counter-arguments or limitations.</li>
                  <li><strong>Reproducibility &amp; Rigor:</strong> Clarity of research procedures, citation integrity, and transparency of underlying data or source references.</li>
                </ul>
              </div>

              {/* Paper Criteria 3 */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBadge} style={{ background: "rgba(126,143,199,0.12)", color: "#7e8fc7" }}>
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>3. Overall RRL Score (0–100%)</h3>
                    <span className={styles.weightBadge}>Composite Synthesis Score</span>
                  </div>
                </div>
                <p className={styles.cardDescription}>
                  Reflects overall paper quality, academic value, and its potential synthesis contribution to your Literature Review (RRL).
                </p>
                <ul className={styles.bulletList}>
                  <li><strong>Key Strengths:</strong> Major empirical findings, novel theoretical insights, or key analytical contributions.</li>
                  <li><strong>Limitations:</strong> Methodological gaps, unaddressed assumptions, or contextual constraints.</li>
                  <li><strong>RRL Contribution:</strong> How effectively the study fills research gaps and provides grounding for "{activeName}".</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.primaryBtn}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
