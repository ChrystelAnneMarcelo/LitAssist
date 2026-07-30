"use client";

import { FileText, CheckSquare, Square } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface PaperRowProps {
  paper: Paper;
  isSelected: boolean;
  onToggle: () => void;
}

export default function PaperRow({ paper, isSelected, onToggle }: PaperRowProps) {
  return (
    <div
      className={styles.row}
      style={{ background: isSelected ? "rgba(201,169,110,0.04)" : "transparent" }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div className={styles.rowCheck} style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }}>
        {isSelected ? (
          <CheckSquare size={14} />
        ) : (
          <Square size={14} style={{ opacity: 0.4 }} />
        )}
      </div>
      <FileText size={14} className={styles.rowFileIcon} />
      <div className={styles.rowTitle}>{paper.title}</div>
      <div className={styles.rowAuthors}>{paper.authors}</div>
      <div className={styles.rowDate}>{paper.added}</div>
    </div>
  );
}
