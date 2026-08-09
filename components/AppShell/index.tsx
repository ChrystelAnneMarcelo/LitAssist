"use client";

import { useState, useEffect, useCallback } from "react";
import type { Project, Paper, CenterTab, SidebarTab, RightTab, ChatSession, ChatMessage } from "@/types";
import LeftSidebar from "@/components/LeftSidebar";
import FileListView from "@/components/FileListView";
import RightPanel from "@/components/RightPanel";
import {
  fetchProjects,
  createProject,
  updateProjectApi,
  deleteProjectApi,
  addPaperApi,
  deletePaperApi,
  fetchChats,
  createChatApi,
  deleteChatApi,
  addMessageApi,
} from "@/lib/api";
import styles from "./styles.module.css";

export default function AppShell() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [centerTab, setCenterTab] = useState<CenterTab>("files");
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<RightTab>("ask");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Theme is a UI preference, not app data — localStorage is fine for it.
  useEffect(() => {
    const savedTheme = localStorage.getItem("litassist-theme") as "dark" | "light" | null;
    const initial = savedTheme || "dark";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  // Load projects + chat sessions from the backend (MongoDB) on mount.
  const loadFromBackend = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [loadedProjects, loadedChats] = await Promise.all([fetchProjects(), fetchChats()]);
      setProjects(loadedProjects);
      setChatSessions(loadedChats);
      if (loadedProjects.length > 0) setActiveProjectId((prev) => prev || loadedProjects[0].id);
      if (loadedChats.length > 0) setActiveChatId((prev) => prev || loadedChats[0].id);
    } catch (err: any) {
      console.error("Failed to load from backend:", err);
      setLoadError(
        err?.message?.includes("fetch")
          ? "Can't reach the backend. Is it running on http://localhost:8000?"
          : err?.message || "Failed to load data from the database."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFromBackend();
  }, [loadFromBackend]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("litassist-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const activeChatSession = chatSessions.find((c) => c.id === activeChatId) ?? chatSessions[0] ?? null;

  const hasProjects = projects.length > 0;
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null;

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setRightTab("ask");
    const targetChat = chatSessions.find((c) => c.id === chatId);
    if (targetChat?.projectId) setActiveProjectId(targetChat.projectId);
  };

  const handleNewChat = async () => {
    if (!activeProjectId) return;
    try {
      const session = await createChatApi(activeProjectId, "New RRL Chat");
      setChatSessions((prev) => [session, ...prev]);
      setActiveChatId(session.id);
      setRightTab("ask");
    } catch (err) {
      console.error("Failed to create chat session:", err);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    const prevSessions = chatSessions;
    setChatSessions((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = prevSessions.filter((c) => c.id !== chatId);
      setActiveChatId(remaining[0]?.id ?? null);
    }
    try {
      await deleteChatApi(chatId);
    } catch (err) {
      console.error("Failed to delete chat session, reverting:", err);
      setChatSessions(prevSessions); // roll back optimistic update
    }
  };

  // ChatView hands us the FULL message array for the session on every turn
  // (it appends locally, then calls this once). We diff against what we
  // already have and persist only the newly-appended message(s), since the
  // backend's endpoint is an append, not a full replace.
  //
  // Edge case: if a project has zero chat sessions, ChatView invents a
  // throwaway local id (`c-${Date.now()}`) rather than calling onNewChat
  // first. That id won't match anything from the backend, so we detect it
  // here and create a real session on the fly instead of silently dropping
  // the message.
  const handleUpdateChatMessages = (chatId: string, newMessages: ChatMessage[], newTitle?: string) => {
    setChatSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === chatId);

      if (existingIndex === -1) {
        (async () => {
          try {
            const session = await createChatApi(activeProjectId, newTitle || "New RRL Chat");
            for (const msg of newMessages) {
              const { id, ...rest } = msg;
              await addMessageApi(session.id, rest);
            }
            setActiveChatId(session.id);
            setChatSessions((cur) => [
              { ...session, title: newTitle || session.title, messages: newMessages },
              ...cur,
            ]);
          } catch (err) {
            console.error("Failed to create chat session for new conversation:", err);
          }
        })();
        return prev;
      }

      const session = prev[existingIndex];
      const appended = newMessages.slice(session.messages.length);
      appended.forEach((msg) => {
        const { id, ...rest } = msg; // id is server-generated; drop the client placeholder
        addMessageApi(chatId, rest).catch((err) =>
          console.error("Failed to persist chat message:", err)
        );
      });

      const next = [...prev];
      next[existingIndex] = { ...session, title: newTitle || session.title, messages: newMessages };
      return next;
    });
  };

  const MAX_SELECTED_PAPERS = 4;

  const togglePaperSelect = (id: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTED_PAPERS) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setSelectedPaperIds(new Set());
    setCenterTab("files");
  };

  const handleAddProject = async (name: string, description: string = "") => {
    try {
      const project = await createProject(name, description);
      setProjects((prev) => [...prev, project]);
      setActiveProjectId(project.id);
      setCenterTab("files");
    } catch (err) {
      console.error("Failed to create project:", err);
    }
  };

  const handleUpdateProjectDescription = async (description: string) => {
    setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? { ...p, description } : p)));
    try {
      await updateProjectApi(activeProjectId, { description });
    } catch (err) {
      console.error("Failed to save project description:", err);
    }
  };

  // Notes/Draft views persist to the backend themselves (they need their own
  // save-status UI and debouncing); this just keeps AppShell's copy of
  // `projects` in sync afterwards so switching tabs/projects doesn't lose
  // what was just saved.
  const handleUpdateProject = (projectId: string, updates: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p)));
  };

  const handleDeleteProject = async (id: string) => {
    if (projects.length <= 1) return;
    const prevProjects = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = prevProjects.filter((p) => p.id !== id);
      setActiveProjectId(remaining[0]?.id ?? "");
    }
    try {
      await deleteProjectApi(id);
      // Project deletion cascades to its chat sessions server-side — mirror that locally
      setChatSessions((prev) => prev.filter((c) => c.projectId !== id));
    } catch (err) {
      console.error("Failed to delete project, reverting:", err);
      setProjects(prevProjects);
    }
  };

  const handleAddPaper = async (paper: Paper) => {
    if (!activeProjectId) {
      console.error("Cannot add a paper: no active project selected.");
      return;
    }
    const { id, ...paperBody } = paper; // id is client-generated locally; backend assigns the real one
    try {
      const savedPaper = await addPaperApi(activeProjectId, paperBody);
      setProjects((prev) =>
        prev.map((p) => (p.id === activeProjectId ? { ...p, papers: [savedPaper, ...p.papers] } : p))
      );
    } catch (err) {
      console.error("Failed to save paper:", err);
    }
  };

  // AnalyzeSummarizeView already persisted the paper (e.g. its `analysis`
  // field) via savePaperAnalysisApi — this just merges the server's
  // response into local state so every view stays in sync.
  const handleUpdatePaper = (updatedPaper: Paper) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, papers: p.papers.map((item) => (item.id === updatedPaper.id ? updatedPaper : item)) }
          : p
      )
    );
  };

  const handleDeletePaper = async (paperId: string) => {
    const prevProjects = projects;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, papers: p.papers.filter((item) => item.id !== paperId) } : p
      )
    );
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      next.delete(paperId);
      return next;
    });
    try {
      await deletePaperApi(activeProjectId, paperId);
    } catch (err) {
      console.error("Failed to delete paper, reverting:", err);
      setProjects(prevProjects);
    }
  };

  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");

  if (isLoading) {
    return (
      <div className={styles.shell} style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
        <span style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading your projects…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.shell} style={{ alignItems: "center", justifyContent: "center", display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ color: "var(--destructive)", fontSize: 13 }}>{loadError}</span>
        <button onClick={loadFromBackend} style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--input-background)", color: "var(--foreground)", cursor: "pointer" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <LeftSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        chatSessions={chatSessions}
        activeChatId={activeChatId}
        sidebarTab={sidebarTab}
        onTabChange={setSidebarTab}
        onSelectProject={handleSelectProject}
        onAddProject={handleAddProject}
        onDeleteProject={handleDeleteProject}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {hasProjects && activeProject ? (
        <>
          <FileListView
            project={activeProject}
            centerTab={centerTab}
            onCenterTabChange={setCenterTab}
            selectedPaperIds={selectedPaperIds}
            onToggleSelect={togglePaperSelect}
            onClearSelection={() => setSelectedPaperIds(new Set())}
            onAddPaper={handleAddPaper}
            onUpdatePaper={handleUpdatePaper}
            onDeletePaper={handleDeletePaper}
            onDeleteProject={handleDeleteProject}
            canDeleteProject={projects.length > 1}
            onUpdateDescription={handleUpdateProjectDescription}
            onUpdateProject={handleUpdateProject}
            theme={theme}
            onToggleTheme={toggleTheme}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />

          <RightPanel
            project={activeProject}
            tab={rightTab}
            onTabChange={setRightTab}
            onUpdateProject={handleUpdateProject}
            selectedPapers={activeProject.papers.filter((p) => selectedPaperIds.has(p.id))}
            activeChatSession={activeChatSession}
            onUpdateChatMessages={handleUpdateChatMessages}
            onNewChat={handleNewChat}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "var(--muted-foreground)",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--foreground)" }}>
            Welcome to LitAssist
          </span>
          <span style={{ fontSize: 13, maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
            You don't have any projects yet. Click <strong>"+ New project"</strong> in the sidebar
            to create one and start adding papers.
          </span>
        </div>
      )}
    </div>
  );
}
