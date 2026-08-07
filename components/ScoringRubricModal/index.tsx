"use client";

import { X, Award, CheckCircle2, Sliders, Info } from "lucide-react";
import type { Project } from "@/types";
import styles from "./styles.module.css";

interface ScoringRubricModalProps {
  onClose: () => void;
  project?: Project | null;
  projectName?: string;
  projectDescription?: string;
}

export default function ScoringRubricModal({
  onClose,
  project,
  projectName,
  projectDescription,
}: ScoringRubricModalProps) {
  const activeName = projectName || project?.name || "Your Active Project";
  const activeDesc = projectDescription || project?.description || "";

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
              <h2 className={styles.modalTitle}>Paper Appraisal & Scoring Rubric</h2>
              <p className={styles.modalSubtitle}>
                Evaluation framework for <strong>"{activeName}"</strong>
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
                Every paper in LitAssist is evaluated against the research scope defined for <strong>"{activeName}"</strong>{activeDesc ? ` (${activeDesc})` : ""}.
              </p>
              <p className={styles.introSubtext}>
                LitAssist evaluates paper alignment, methodological quality, and synthesis contribution across all academic disciplines.
              </p>
            </div>
          </div>

          {/* Criteria Cards */}
          <div className={styles.rubricGrid}>
            {/* Criteria 1 */}
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

            {/* Criteria 2 */}
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
                <li><strong>Data & Evidence Quality:</strong> Relevance, integrity, sample adequacy, and source reliability of the data, primary sources, or evidence analyzed.</li>
                <li><strong>Research & Conceptual Design:</strong> Clarity, appropriateness, and logical soundness of the analytical framework, methodology, or reasoning.</li>
                <li><strong>Validation & Argumentation:</strong> Depth of critical analysis, robustness of validation procedures, and effectiveness in addressing counter-arguments or limitations.</li>
                <li><strong>Reproducibility & Rigor:</strong> Clarity of research procedures, citation integrity, and transparency of underlying data or source references.</li>
              </ul>
            </div>

            {/* Criteria 3 */}
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
