"use client";

import { useState } from "react";
import { FolderOpen, MessageSquare, Plus, BookMarked, Sparkles, ChevronDown } from "lucide-react";
import type { Project, SidebarTab } from "@/types";
import AddProjectModal from "./AddProjectModal";
import styles from "./styles.module.css";

const CHAT_HISTORY = [
  { id: "c1", label: "Summarize lettuce deficiency paper", time: "2h ago" },
  { id: "c2", label: "What are gaps in YOLOv5 studies?", time: "Yesterday" },
  { id: "c3", label: "Compare methodologies across papers", time: "May 9" },
];

interface LeftSidebarProps {
  projects: Project[];
  activeProjectId: string;
  sidebarTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string) => void;
}

export default function LeftSidebar({
  projects,
  activeProjectId,
  sidebarTab,
  onTabChange,
  onSelectProject,
  onAddProject,
}: LeftSidebarProps) {
  const [showAddProject, setShowAddProject] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <div
        className={styles.sidebar}
        style={{ width: collapsed ? 52 : 220 }}
      >
        {/* Logo / Brand */}
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Sparkles size={13} style={{ color: "var(--primary)" }} />
          </div>
          {!collapsed && <span className={styles.logoName}>LitAssist</span>}
          {!collapsed && (
            <button className={styles.collapseBtn} onClick={() => setCollapsed(true)}>
              <ChevronDown size={13} style={{ transform: "rotate(90deg)" }} />
            </button>
          )}
        </div>

        {/* Collapsed strip */}
        {collapsed ? (
          <div className={styles.collapsedIcons}>
            <button
              className={`${styles.iconBtn} ${sidebarTab === "files" ? styles.active : ""}`}
              onClick={() => { onTabChange("files"); setCollapsed(false); }}
            >
              <FolderOpen size={16} />
            </button>
            <button
              className={`${styles.iconBtn} ${sidebarTab === "chats" ? styles.active : ""}`}
              onClick={() => { onTabChange("chats"); setCollapsed(false); }}
            >
              <MessageSquare size={16} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => setShowAddProject(true)}
            >
              <Plus size={16} />
            </button>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${sidebarTab === "files" ? styles.active : ""}`}
                onClick={() => onTabChange("files")}
              >
                <FolderOpen size={11} /> Files
              </button>
              <button
                className={`${styles.tab} ${sidebarTab === "chats" ? styles.active : ""}`}
                onClick={() => onTabChange("chats")}
              >
                <MessageSquare size={11} /> Chats
              </button>
            </div>

            {/* Scroll area */}
            <div className={styles.scrollArea}>
              {sidebarTab === "files" ? (
                <>
                  <div className={styles.sectionLabel}>
                    <span className={styles.sectionTitle}>PROJECTS</span>
                    <button className={styles.sectionAdd} onClick={() => setShowAddProject(true)}>
                      <Plus size={11} />
                    </button>
                  </div>

                  {projects.map((project) => {
                    const isActive = project.id === activeProjectId;
                    return (
                      <button
                        key={project.id}
                        className={`${styles.projectItem} ${isActive ? styles.active : ""}`}
                        onClick={() => onSelectProject(project.id)}
                      >
                        <BookMarked
                          size={12}
                          className={styles.projectIcon}
                          style={{ color: isActive ? "var(--sidebar-primary)" : "var(--muted-foreground)" }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.projectName}>{project.name}</div>
                          <div className={styles.projectMeta}>
                            {project.papers.length} papers · {project.createdAt}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    className={styles.addProjectBtn}
                    onClick={() => setShowAddProject(true)}
                  >
                    <Plus size={12} />
                    New project
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.sectionLabel}>
                    <span className={styles.sectionTitle}>RECENT CHATS</span>
                  </div>
                  {CHAT_HISTORY.map((chat) => (
                    <button key={chat.id} className={styles.chatItem}>
                      <span className={styles.chatLabel}>{chat.label}</span>
                      <span className={styles.chatTime}>{chat.time}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <div className={styles.avatar}>R</div>
              <div style={{ minWidth: 0 }}>
                <div className={styles.userName}>Researcher</div>
                <div className={styles.userPlan}>Free plan</div>
              </div>
            </div>
          </>
        )}
      </div>

      {showAddProject && (
        <AddProjectModal
          onClose={() => setShowAddProject(false)}
          onAdd={onAddProject}
        />
      )}
    </>
  );
}
