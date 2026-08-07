"use client";

import { useState } from "react";
import { FolderOpen, MessageSquare, Plus, BookMarked, Sparkles, ChevronDown, Sun, Moon, Trash2, Search, X } from "lucide-react";
import type { Project, SidebarTab, ChatSession } from "@/types";
import AddProjectModal from "./AddProjectModal";
import styles from "./styles.module.css";

interface LeftSidebarProps {
  projects: Project[];
  activeProjectId: string;
  chatSessions?: ChatSession[];
  activeChatId?: string | null;
  sidebarTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onSelectProject: (id: string) => void;
  onAddProject: (name: string, description: string) => void;
  onDeleteProject?: (id: string) => void;
  onSelectChat?: (chatId: string) => void;
  onNewChat?: () => void;
  onDeleteChat?: (chatId: string) => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export default function LeftSidebar({
  projects,
  activeProjectId,
  chatSessions = [],
  activeChatId,
  sidebarTab,
  onTabChange,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  theme = "dark",
  onToggleTheme,
}: LeftSidebarProps) {
  const [showAddProject, setShowAddProject] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredChatId, setHoveredChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
  });

  const filteredChats = chatSessions.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return c.title.toLowerCase().includes(q);
  });

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
              title="Files"
            >
              <FolderOpen size={16} />
            </button>
            <button
              className={`${styles.iconBtn} ${sidebarTab === "chats" ? styles.active : ""}`}
              onClick={() => { onTabChange("chats"); setCollapsed(false); }}
              title="Chats"
            >
              <MessageSquare size={16} />
            </button>
            <button
              className={styles.iconBtn}
              onClick={() => {
                if (sidebarTab === "files") setShowAddProject(true);
                else if (onNewChat) onNewChat();
              }}
              title={sidebarTab === "files" ? "New project" : "New chat"}
            >
              <Plus size={16} />
            </button>
            {onToggleTheme && (
              <button
                className={styles.iconBtn}
                onClick={onToggleTheme}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{ marginTop: "auto" }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            )}
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

            {/* Search bar */}
            <div className={styles.searchContainer}>
              <div className={styles.searchBox}>
                <Search size={11} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder={sidebarTab === "files" ? "Search projects…" : "Search chats…"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className={styles.clearSearchBtn} title="Clear search">
                    <X size={10} />
                  </button>
                )}
              </div>
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

                  {filteredProjects.map((project) => {
                    const isActive = project.id === activeProjectId;
                    const isHovered = hoveredProjectId === project.id;
                    return (
                      <div
                        key={project.id}
                        onMouseEnter={() => setHoveredProjectId(project.id)}
                        onMouseLeave={() => setHoveredProjectId(null)}
                        style={{ position: "relative", display: "flex", alignItems: "center" }}
                      >
                        <button
                          className={`${styles.projectItem} ${isActive ? styles.active : ""}`}
                          onClick={() => onSelectProject(project.id)}
                          style={{ paddingRight: onDeleteProject && isHovered && projects.length > 1 ? 30 : 16 }}
                        >
                          <BookMarked
                            size={12}
                            className={styles.projectIcon}
                            style={{ color: isActive ? "var(--sidebar-primary)" : "var(--muted-foreground)" }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className={styles.projectName}>{project.name}</div>
                            <div className={styles.projectMeta}>
                              {project.papers.length} papers · {project.createdAt}
                            </div>
                          </div>
                        </button>
                        {onDeleteProject && isHovered && projects.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteProject(project.id);
                            }}
                            style={{
                              position: "absolute",
                              right: 8,
                              color: "var(--destructive)",
                              padding: 4,
                              borderRadius: 4,
                              background: "rgba(0,0,0,0.2)",
                            }}
                            title="Delete project"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {filteredProjects.length === 0 && (
                    <div style={{ padding: "12px 16px", fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      No projects found
                    </div>
                  )}

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
                    {onNewChat && (
                      <button className={styles.sectionAdd} onClick={onNewChat} title="New chat">
                        <Plus size={11} />
                      </button>
                    )}
                  </div>

                  {filteredChats.map((chat) => {
                    const isActive = chat.id === activeChatId;
                    const isHovered = hoveredChatId === chat.id;
                    return (
                      <div
                        key={chat.id}
                        onMouseEnter={() => setHoveredChatId(chat.id)}
                        onMouseLeave={() => setHoveredChatId(null)}
                        style={{ position: "relative", display: "flex", alignItems: "center" }}
                      >
                        <button
                          className={styles.chatItem}
                          onClick={() => onSelectChat && onSelectChat(chat.id)}
                          style={{
                            background: isActive ? "var(--sidebar-accent)" : "transparent",
                            borderLeft: isActive ? "2px solid var(--sidebar-primary)" : "2px solid transparent",
                            paddingRight: isHovered && onDeleteChat ? 30 : 16,
                          }}
                        >
                          <span className={styles.chatLabel} style={{ color: isActive ? "var(--sidebar-foreground)" : "var(--muted-foreground)", fontWeight: isActive ? 500 : 400 }}>
                            {chat.title}
                          </span>
                          <span className={styles.chatTime}>{chat.createdAt}</span>
                        </button>
                        {onDeleteChat && isHovered && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteChat(chat.id);
                            }}
                            style={{
                              position: "absolute",
                              right: 8,
                              color: "var(--destructive)",
                              padding: 4,
                              borderRadius: 4,
                              background: "rgba(0,0,0,0.2)",
                            }}
                            title="Delete chat session"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {filteredChats.length === 0 && (
                    <div style={{ padding: "12px 16px", fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>
                      No chats found
                    </div>
                  )}

                  {onNewChat && (
                    <button
                      className={styles.addProjectBtn}
                      onClick={onNewChat}
                    >
                      <Plus size={12} />
                      New chat
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <div className={styles.avatar}>R</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className={styles.userName}>Researcher</div>
                <div className={styles.userPlan}>Free plan</div>
              </div>
              {onToggleTheme && (
                <button
                  className={styles.themeToggleBtn}
                  onClick={onToggleTheme}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
                </button>
              )}
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
