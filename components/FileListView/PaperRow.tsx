"use client";

import { useState } from "react";
import { FileText, CheckSquare, Square, Trash2, Eye } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface PaperRowProps {
  paper: Paper;
  isSelected: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  onOpenDetail?: () => void;
}

export default function PaperRow({
  paper,
  isSelected,
  onToggle,
  onDelete,
  onOpenDetail,
}: PaperRowProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className={styles.row}
      style={{ background: isSelected ? "rgba(201,169,110,0.04)" : "transparent" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Selection Checkbox */}
      <div
        className={styles.rowCheck}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }}
        title={isSelected ? "Unselect paper" : "Select paper"}
      >
        {isSelected ? <CheckSquare size={14} /> : <Square size={14} style={{ opacity: 0.4 }} />}
      </div>

      <FileText size={14} className={styles.rowFileIcon} />

      {/* Title */}
      <div
        className={styles.rowTitle}
        onClick={onOpenDetail || onToggle}
        title={paper.title}
      >
        {paper.title}
      </div>

      {/* Authors */}
      <div className={styles.rowAuthors}>{paper.authors}</div>

      {/* Date Added */}
      <div className={styles.rowDate}>{paper.added}</div>

      {/* Row Actions on Hover */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, opacity: hover ? 1 : 0, transition: "opacity 0.15s" }}>
        {onOpenDetail && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className={styles.toolbarIcon}
            title="View Paper Details"
          >
            <Eye size={13} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={styles.toolbarIcon}
            title="Delete Paper"
            style={{ color: "var(--destructive)" }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
