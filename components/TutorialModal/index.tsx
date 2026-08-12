"use client";

import { X, HelpCircle } from "lucide-react";
import styles from "./styles.module.css";

interface TutorialModalProps {
  onClose: () => void;
}

export default function TutorialModal({ onClose }: TutorialModalProps) {
  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.titleRow}>
            <HelpCircle size={20} style={{ color: "var(--primary)" }} />
            <div>
              <h2 className={styles.modalTitle}>LitAssist Tutorial</h2>
              <p className={styles.modalSubtitle}>Step-by-step guidance for using the app.</p>
            </div>
          </div>
          <button onClick={onClose} className={styles.closeBtn} title="Close tutorial">
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>1</span>
            <div>
              <h3>Add your project and papers</h3>
              <p>Start by creating a project, then add literature by DOI, PDF, or manual entry so LitAssist can analyze and synthesize it.</p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>2</span>
            <div>
              <h3>Select papers as context</h3>
              <p>Pick the papers you want the AI to use in the right-hand Ask AI panel. Selected papers become the active RAG context.</p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>3</span>
            <div>
              <h3>Ask questions or use suggestions</h3>
              <p>Use the suggested prompts or type your own question. Every AI answer shows how many tokens were consumed for transparency.</p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>4</span>
            <div>
              <h3>Generate a draft</h3>
              <p>Open the Draft tab to generate an RRL section from selected papers. Token usage for generation is displayed in the editor footer.</p>
            </div>
          </div>

          <div className={styles.stepCard}>
            <span className={styles.stepNumber}>5</span>
            <div>
              <h3>Review and refine</h3>
              <p>Run the review tool to get a score and feedback. The reviewer also shows token usage for the evaluation call.</p>
            </div>
          </div>

          <div className={styles.noteBox}>
            <strong>Tip:</strong> Use the scoring rubric any time to understand what LitAssist is checking for in your papers and draft.
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.primaryBtn}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
