"use client";

import { useState } from "react";
import {
  LayoutList, LayoutGrid, ArrowUpDown, Filter, Plus, FileText,
  GitCompare, X, Sun, Moon, Search, Calendar, User, Tag, Square, Trash2, AlertTriangle
} from "lucide-react";
import type { Project, Paper, CenterTab } from "@/types";
import PaperRow from "./PaperRow";
import AddPaperModal from "./AddPaperModal";
import CompareModal from "./CompareModal";
import PaperDetailModal from "./PaperDetailModal";
import AnalyzeSummarizeView from "@/components/AnalyzeSummarizeView";
import MyDraftView from "@/components/MyDraftView";
import styles from "./styles.module.css";

interface FileListViewProps {
  project: Project;
  centerTab: CenterTab;
  onCenterTabChange: (tab: CenterTab) => void;
  selectedPaperIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onClearSelection: () => void;
  onAddPaper: (paper: Paper) => void;
  onDeletePaper?: (paperId: string) => void;
  onUpdateDescription?: (description: string) => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  onDeleteProject?: (id: string) => void;
  canDeleteProject?: boolean;
}

export default function FileListView({
  project,
  centerTab,
  onCenterTabChange,
  selectedPaperIds,
  onToggleSelect,
  onClearSelection,
  onAddPaper,
  onDeletePaper,
  onUpdateDescription,
  theme = "dark",
  onToggleTheme,
  selectedModel,
  onModelChange,
  onDeleteProject,
  canDeleteProject = true,
}: FileListViewProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeDetailPaper, setActiveDetailPaper] = useState<Paper | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<"title" | "authors" | "year" | "added">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descInput, setDescInput] = useState(project.description || "");

  const selectedPapers = project.papers.filter((p) => selectedPaperIds.has(p.id));

  // Filter papers based on search query
  const filteredPapers = project.papers.filter((paper) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      paper.title.toLowerCase().includes(q) ||
      paper.authors.toLowerCase().includes(q) ||
      paper.journal.toLowerCase().includes(q) ||
      paper.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const sorted = [...filteredPapers].sort((a, b) => {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <span className={styles.projectTitle}>{project.name}</span>
          {onDeleteProject && canDeleteProject && (
            <button
              onClick={() => setShowDeleteModal(true)}
              title={`Delete project "${project.name}"`}
              style={{
                background: "rgba(192, 57, 43, 0.1)",
                border: "1px solid rgba(192, 57, 43, 0.25)",
                color: "var(--destructive)",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              <Trash2 size={11} />
              <span>Delete</span>
            </button>
          )}
        </div>
        <div className={styles.topBarRight}>
          <span className={styles.fileCount}>{project.papers.length} files in folder</span>
          <div className={styles.toolbarBtns}>
            <button className={styles.toolbarBtn} onClick={() => setShowAddModal(true)}>
              <Plus size={13} /> Add
            </button>
            <button
              className={styles.toolbarIcon}
              onClick={() => setShowFilterBar((prev) => !prev)}
              title="Toggle search & filter bar"
              style={{ color: showFilterBar || searchQuery ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              <Filter size={13} />
            </button>
            <button
              className={styles.toolbarIcon}
              onClick={() => setViewMode((prev) => (prev === "list" ? "grid" : "list"))}
              title={viewMode === "list" ? "Switch to Grid View" : "Switch to List View"}
            >
              {viewMode === "list" ? <LayoutGrid size={13} /> : <LayoutList size={13} />}
            </button>
            {onToggleTheme && (
              <button
                className={styles.toolbarIcon}
                onClick={onToggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Research Topic / Scope Banner */}
      <div
        style={{
          padding: "8px 20px",
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", flexShrink: 0 }}>
          RESEARCH SCOPE:
        </span>
        {isEditingDesc ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <input
              type="text"
              value={descInput}
              onChange={(e) => setDescInput(e.target.value)}
              placeholder="e.g. AI-based methods for detecting diseases and deficiencies in lettuce crops"
              style={{
                flex: 1,
                background: "var(--background)",
                border: "1px solid var(--primary)",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
                color: "var(--foreground)",
                fontSize: 12,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (onUpdateDescription) onUpdateDescription(descInput.trim());
                  setIsEditingDesc(false);
                } else if (e.key === "Escape") {
                  setIsEditingDesc(false);
                }
              }}
              autoFocus
            />
            <button
              onClick={() => {
                if (onUpdateDescription) onUpdateDescription(descInput.trim());
                setIsEditingDesc(false);
              }}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "2px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Save
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <span
              onClick={() => {
                setDescInput(project.description || "");
                setIsEditingDesc(true);
              }}
              style={{
                color: project.description ? "var(--foreground)" : "var(--muted-foreground)",
                fontStyle: project.description ? "normal" : "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer",
              }}
              title="Click to edit research topic"
            >
              {project.description || "No research topic specified yet — click to add scope..."}
            </span>
            <button
              onClick={() => {
                setDescInput(project.description || "");
                setIsEditingDesc(true);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--muted-foreground)",
                cursor: "pointer",
                padding: 2,
                display: "flex",
                alignItems: "center",
              }}
              title="Edit Research Scope"
            >
              <FileText size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Optional Search / Filter Bar */}
      {showFilterBar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--input-background)",
          }}
        >
          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
          <input
            type="text"
            placeholder="Search papers by title, author, journal, or tag…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--foreground)",
              fontSize: 12,
              outline: "none",
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ color: "var(--muted-foreground)" }}>
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        {(["files", "analyze", "draft"] as CenterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onCenterTabChange(tab)}
            className={`${styles.centerTab} ${centerTab === tab ? styles.activeTab : ""}`}
          >
            {tab === "files" ? "Files" : tab === "analyze" ? "Summarize & Score" : "My Draft"}
          </button>
        ))}

        <div className={styles.tabActions}>
          {selectedPapers.length >= 2 && centerTab === "files" && (
            <button className={styles.compareBtn} onClick={() => setShowCompare(true)}>
              <GitCompare size={11} /> Compare ({selectedPapers.length}/4)
            </button>
          )}
          {selectedPapers.length > 0 && centerTab === "files" && (
            <button className={styles.clearBtn} onClick={onClearSelection}>
              <X size={11} /> Clear ({selectedPapers.length})
            </button>
          )}
          {selectedPapers.length === 4 && centerTab === "files" && (
            <span style={{ fontSize: 10, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
              (Max 4 papers selected)
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      {centerTab === "files" ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          {viewMode === "list" ? (
            <>
              {/* Column headers */}
              <div className={styles.columnHeader}>
                <div className={styles.rowCheck} style={{ visibility: "hidden" }}>
                  <Square size={14} />
                </div>
                <FileText size={14} className={styles.rowFileIcon} style={{ visibility: "hidden" }} />
                <button className={styles.colName} onClick={() => toggleSort("title")}>
                  NAME {sortField === "title" && <ArrowUpDown size={10} />}
                </button>
                <button className={styles.colAuthors} onClick={() => toggleSort("authors")}>
                  AUTHORS {sortField === "authors" && <ArrowUpDown size={10} />}
                </button>
                <button className={styles.colAdded} onClick={() => toggleSort("year")}>
                  YEAR {sortField === "year" && <ArrowUpDown size={10} />}
                </button>
                <div className={styles.rowActionsSpacer} />
              </div>

              {/* Paper list */}
              <div className={styles.paperList}>
                {sorted.length === 0 ? (
                  <div className={styles.empty}>
                    <FileText size={32} style={{ color: "var(--muted-foreground)" }} />
                    <div>
                      <p className={styles.emptyTitle}>
                        {searchQuery ? "No matching papers found" : "No papers yet"}
                      </p>
                      <p className={styles.emptyHint}>
                        {searchQuery
                          ? "Try searching for a different keyword"
                          : "Click Add to upload your first paper"}
                      </p>
                    </div>
                  </div>
                ) : (
                  sorted.map((paper) => (
                    <PaperRow
                      key={paper.id}
                      paper={paper}
                      isSelected={selectedPaperIds.has(paper.id)}
                      onToggle={() => onToggleSelect(paper.id)}
                      onDelete={onDeletePaper ? () => onDeletePaper(paper.id) : undefined}
                      onOpenDetail={() => setActiveDetailPaper(paper)}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            /* Grid / Card View Mode */
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
                alignContent: "start",
              }}
            >
              {sorted.map((paper) => {
                const isSel = selectedPaperIds.has(paper.id);
                return (
                  <div
                    key={paper.id}
                    onClick={() => setActiveDetailPaper(paper)}
                    style={{
                      background: "var(--card)",
                      border: `1px solid ${isSel ? "var(--primary)" : "var(--border)"}`,
                      borderRadius: "var(--radius-lg)",
                      padding: 14,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <FileText size={14} style={{ color: "var(--primary)" }} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect(paper.id);
                          }}
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            color: isSel ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                        >
                          {isSel ? "Selected" : "Select"}
                        </button>
                      </div>
                      <h4
                        style={{
                          fontSize: 12,
                          color: "var(--foreground)",
                          fontWeight: 500,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {paper.title}
                      </h4>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                        {paper.authors} · {paper.year}
                      </div>
                      {paper.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          {paper.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 9,
                                fontFamily: "var(--font-mono)",
                                padding: "2px 6px",
                                borderRadius: 9999,
                                background: "rgba(201,169,110,0.08)",
                                color: "var(--primary)",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : centerTab === "analyze" ? (
        <AnalyzeSummarizeView papers={project.papers} onAddPaper={onAddPaper} project={project} />
      ) : (
        <MyDraftView project={project} selectedModel={selectedModel} onModelChange={onModelChange} />
      )}

      {/* Modals */}
      {showAddModal && (
        <AddPaperModal onClose={() => setShowAddModal(false)} onAdd={onAddPaper} />
      )}
      {showCompare && selectedPapers.length >= 2 && (
        <CompareModal papers={selectedPapers} onClose={() => setShowCompare(false)} />
      )}
      {activeDetailPaper && (
        <PaperDetailModal paper={activeDetailPaper} onClose={() => setActiveDetailPaper(null)} project={project} />
      )}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              width: "100%",
              maxWidth: 420,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(192, 57, 43, 0.15)",
                  border: "1px solid rgba(192, 57, 43, 0.3)",
                  color: "var(--destructive)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)" }}>Delete Project</h3>
                <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>This action cannot be undone.</p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>"{project.name}"</strong> and all <strong>{project.papers.length} paper(s)</strong> in this folder?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onDeleteProject) onDeleteProject(project.id);
                  setShowDeleteModal(false);
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--destructive)",
                  border: "none",
                  color: "var(--destructive-foreground)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
