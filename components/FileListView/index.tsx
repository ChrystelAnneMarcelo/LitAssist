"use client";

import { useState } from "react";
import {
  LayoutList, ArrowUpDown, Filter, Plus, FileText,
  GitCompare, X,
} from "lucide-react";
import type { Project, Paper, CenterTab } from "@/types";
import PaperRow from "./PaperRow";
import AddPaperModal from "./AddPaperModal";
import CompareModal from "./CompareModal";
import AnalyzeSummarizeView from "@/components/AnalyzeSummarizeView";
import styles from "./styles.module.css";

interface FileListViewProps {
  project: Project;
  centerTab: CenterTab;
  onCenterTabChange: (tab: CenterTab) => void;
  selectedPaperIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onAddPaper: (paper: Paper) => void;
}

export default function FileListView({
  project,
  centerTab,
  onCenterTabChange,
  selectedPaperIds,
  onToggleSelect,
  onClearSelection,
  onAddPaper,
}: FileListViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [sortField, setSortField] = useState<"title" | "authors" | "added">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const selectedPapers = project.papers.filter((p) => selectedPaperIds.has(p.id));

  const sorted = [...project.papers].sort((a, b) => {
    const va = a[sortField];
    const vb = b[sortField];
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className={styles.panel}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.projectTitle}>{project.name}</span>
        <div className={styles.topBarRight}>
          <span className={styles.fileCount}>{project.papers.length} files in folder</span>
          <div className={styles.toolbarBtns}>
            <button className={styles.toolbarBtn} onClick={() => setShowAddModal(true)}>
              <Plus size={13} /> Add
            </button>
            <button className={styles.toolbarIcon}>
              <Filter size={13} />
            </button>
            <button className={styles.toolbarIcon}>
              <LayoutList size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {(["files", "analyze"] as CenterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onCenterTabChange(tab)}
            className={`${styles.centerTab} ${centerTab === tab ? styles.activeTab : ""}`}
          >
            {tab === "files" ? "Files" : "Analyze & Summarize"}
          </button>
        ))}

        <div className={styles.tabActions}>
          {selectedPapers.length >= 2 && centerTab === "files" && (
            <button className={styles.compareBtn} onClick={() => setShowCompare(true)}>
              <GitCompare size={11} /> Compare ({selectedPapers.length})
            </button>
          )}
          {selectedPapers.length > 0 && centerTab === "files" && (
            <button className={styles.clearBtn} onClick={onClearSelection}>
              <X size={11} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {centerTab === "files" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {/* Column headers */}
          <div className={styles.columnHeader}>
            <div style={{ width: 14, marginRight: 8, flexShrink: 0 }} />
            <div style={{ width: 14, marginRight: 12, flexShrink: 0 }} />
            <button className={styles.colName} onClick={() => toggleSort("title")}>
              NAME {sortField === "title" && <ArrowUpDown size={10} />}
            </button>
            <button className={styles.colAuthors} onClick={() => toggleSort("authors")}>
              AUTHORS {sortField === "authors" && <ArrowUpDown size={10} />}
            </button>
            <button className={styles.colAdded} onClick={() => toggleSort("added")}>
              ADDED {sortField === "added" && <ArrowUpDown size={10} />}
            </button>
          </div>

          {/* Paper list */}
          <div className={styles.paperList}>
            {sorted.length === 0 ? (
              <div className={styles.empty}>
                <FileText size={32} style={{ color: "var(--muted-foreground)" }} />
                <div>
                  <p className={styles.emptyTitle}>No papers yet</p>
                  <p className={styles.emptyHint}>Click Add to upload your first paper</p>
                </div>
              </div>
            ) : (
              sorted.map((paper) => (
                <PaperRow
                  key={paper.id}
                  paper={paper}
                  isSelected={selectedPaperIds.has(paper.id)}
                  onToggle={() => onToggleSelect(paper.id)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <AnalyzeSummarizeView papers={project.papers} onAddPaper={onAddPaper} />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddPaperModal onClose={() => setShowAddModal(false)} onAdd={onAddPaper} />
      )}
      {showCompare && selectedPapers.length >= 2 && (
        <CompareModal papers={selectedPapers} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
