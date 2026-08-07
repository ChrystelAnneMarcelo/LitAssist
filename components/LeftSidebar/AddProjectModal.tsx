"use client";

import { useState } from "react";
import { X } from "lucide-react";
import styles from "./styles.module.css";

interface AddProjectModalProps {
  onClose: () => void;
  onAdd: (name: string, description: string) => void;
}

export default function AddProjectModal({ onClose, onAdd }: AddProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), description.trim());
    onClose();
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>New Project</span>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <label className={styles.fieldLabel}>PROJECT NAME</label>
          <input
            autoFocus
            className={styles.input}
            placeholder="e.g. Lettuce disease detection"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className={styles.fieldLabel} style={{ marginTop: 12 }}>RESEARCH TOPIC / QUESTION</label>
          <textarea
            className={styles.input}
            style={{ height: 72, resize: "none", paddingTop: 8, paddingBottom: 8, lineHeight: 1.4 }}
            placeholder="e.g. Non-invasive AI methods for detecting diseases and nutrient deficiencies in lettuce crops"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSubmit())}
          />
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={styles.btnPrimary}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
