"use client";

import { useState } from "react";
import { X } from "lucide-react";
import styles from "./styles.module.css";

interface AddProjectModalProps {
  onClose: () => void;
  onAdd: (name: string) => void;
}

export default function AddProjectModal({ onClose, onAdd }: AddProjectModalProps) {
  const [name, setName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim());
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
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
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
