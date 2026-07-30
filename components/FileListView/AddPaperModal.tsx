"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface AddPaperModalProps {
  onClose: () => void;
  onAdd: (paper: Paper) => void;
}

export default function AddPaperModal({ onClose, onAdd }: AddPaperModalProps) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [abstract, setAbstract] = useState("");
  const [tags, setTags] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    const paper: Paper = {
      id: `paper-${Date.now()}`,
      title: title.trim(),
      authors: authors.trim() || "Unknown",
      year: year.trim() || new Date().getFullYear().toString(),
      journal: journal.trim(),
      abstract: abstract.trim(),
      methodology: "",
      keyFindings: [],
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      added: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
    onAdd(paper);
    onClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ width: "min(90vw, 520px)" }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <Upload size={14} style={{ color: "var(--primary)" }} />
            <span className={styles.modalTitle}>Add Paper</span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div>
            <label className={styles.fieldLabel}>TITLE *</label>
            <input
              className={styles.input}
              placeholder="Paper title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className={styles.fieldRow}>
            <div style={{ flex: 1 }}>
              <label className={styles.fieldLabel}>AUTHORS</label>
              <input
                className={styles.input}
                placeholder="Last, et al."
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
              />
            </div>
            <div style={{ width: 90 }}>
              <label className={styles.fieldLabel}>YEAR</label>
              <input
                className={styles.input}
                placeholder="2025"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={styles.fieldLabel}>JOURNAL / SOURCE</label>
            <input
              className={styles.input}
              placeholder="Journal name…"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>ABSTRACT</label>
            <textarea
              className={styles.textarea}
              placeholder="Paste abstract here…"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.fieldLabel}>TAGS (comma-separated)</label>
            <input
              className={styles.input}
              placeholder="Deep Learning, Computer Vision…"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={styles.btnPrimary}
          >
            Add Paper
          </button>
        </div>
      </div>
    </div>
  );
}
