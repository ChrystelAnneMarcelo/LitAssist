"use client";

import { useState, useEffect } from "react";
import { INITIAL_PROJECTS } from "@/data/initialProjects";
import type { Project, Paper, CenterTab, SidebarTab, RightTab, ChatSession, ChatMessage } from "@/types";
import LeftSidebar from "@/components/LeftSidebar";
import FileListView from "@/components/FileListView";
import RightPanel from "@/components/RightPanel";
import styles from "./styles.module.css";

const DEFAULT_CHAT_SESSIONS: ChatSession[] = [
  {
    id: "c1",
    projectId: "p1",
    title: "Summarize lettuce deficiency paper",
    createdAt: "2h ago",
    messages: [
      { id: "m1", role: "user", content: "Summarize lettuce deficiency paper", timestamp: "2h ago" },
      { id: "m2", role: "assistant", content: "The paper *Lettuce Plant Trace-Element-Deficiency Classification* proposes a DenseNet-121 model with hyperspectral imaging (400–1000nm), achieving 91.8% overall classification accuracy for Fe, Mn, Zn, Cu, Mo, and B deficiencies.", timestamp: "2h ago" },
    ],
  },
  {
    id: "c2",
    projectId: "p1",
    title: "What are gaps in YOLOv5 studies?",
    createdAt: "Yesterday",
    messages: [
      { id: "m1", role: "user", content: "What are gaps in YOLOv5 studies?", timestamp: "Yesterday" },
      { id: "m2", role: "assistant", content: "Key gaps identified in YOLOv5 agricultural applications:\n1. **Outdoor occlusion** under natural sunlight.\n2. **Generalizability** to unannotated leaf varieties.\n3. **Real-time memory footprint** on ultra low-power microcontrollers.", timestamp: "Yesterday" },
    ],
  },
  {
    id: "c3",
    projectId: "p1",
    title: "Compare methodologies across papers",
    createdAt: "May 9",
    messages: [
      { id: "m1", role: "user", content: "Compare methodologies across papers", timestamp: "May 9" },
      { id: "m2", role: "assistant", content: "Across the 8 papers in this project:\n• **CNN & YOLO Architectures** represent 84% of empirical models.\n• **RGB-D & Hyperspectral Imaging** provide rich spatial/spectral features (+11.3% over RGB).\n• **Edge Device Quantization (INT8)** reduces model size to 2.1MB for offline operation.", timestamp: "May 9" },
    ],
  },
];

export default function AppShell() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>("p1");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(DEFAULT_CHAT_SESSIONS);
  const [activeChatId, setActiveChatId] = useState<string | null>("c1");

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [centerTab, setCenterTab] = useState<CenterTab>("files");
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<RightTab>("ask");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme, projects, and chat sessions from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("litassist-theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }

    const savedProjects = localStorage.getItem("litassist-projects");
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) setProjects(parsed);
      } catch (e) {
        console.error("Failed to parse saved projects", e);
      }
    }

    const savedChats = localStorage.getItem("litassist-chat-sessions");
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats);
        if (Array.isArray(parsedChats) && parsedChats.length > 0) setChatSessions(parsedChats);
      } catch (e) {
        console.error("Failed to parse saved chats", e);
      }
    }

    setIsLoaded(true);
  }, []);

  // Save projects & chats to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("litassist-projects", JSON.stringify(projects));
      localStorage.setItem("litassist-chat-sessions", JSON.stringify(chatSessions));
    }
  }, [projects, chatSessions, isLoaded]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("litassist-theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? {
    id: "empty",
    name: "New Project",
    description: "",
    createdAt: new Date().toLocaleDateString(),
    papers: [],
  };

  const activeChatSession = chatSessions.find((c) => c.id === activeChatId) ?? chatSessions[0] ?? {
    id: "default-session",
    projectId: activeProjectId,
    title: "New RRL Chat",
    createdAt: "Just now",
    messages: [],
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setRightTab("ask");
    // Also select the project associated with this chat
    const targetChat = chatSessions.find((c) => c.id === chatId);
    if (targetChat && targetChat.projectId) {
      setActiveProjectId(targetChat.projectId);
    }
  };

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: `c-${Date.now()}`,
      projectId: activeProjectId,
      title: "New RRL Chat",
      createdAt: "Just now",
      messages: [],
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveChatId(newSession.id);
    setRightTab("ask");
  };

  const handleDeleteChat = (chatId: string) => {
    setChatSessions((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chatSessions.filter((c) => c.id !== chatId);
      setActiveChatId(remaining[0]?.id ?? null);
    }
  };

  const handleUpdateChatMessages = (chatId: string, newMessages: ChatMessage[], newTitle?: string) => {
    setChatSessions((prev) =>
      prev.map((session) => {
        if (session.id === chatId) {
          return {
            ...session,
            title: newTitle || session.title,
            messages: newMessages,
          };
        }
        return session;
      })
    );
  };

  const MAX_SELECTED_PAPERS = 4;

  const togglePaperSelect = (id: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTED_PAPERS) {
          return prev;
        }
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

  const handleAddProject = (name: string, description: string = "") => {
    const newProject: Project = {
      id: `p${Date.now()}`,
      name,
      description,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      papers: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setCenterTab("files");
  };

  const handleUpdateProjectDescription = (description: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, description } : p))
    );
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter((p) => p.id !== id);
      setActiveProjectId(remaining[0]?.id ?? "");
    }
  };

  const handleAddPaper = (paper: Paper) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, papers: [paper, ...p.papers] } : p
      )
    );
  };

  const handleDeletePaper = (paperId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, papers: p.papers.filter((item) => item.id !== paperId) }
          : p
      )
    );
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      next.delete(paperId);
      return next;
    });
  };

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

      <FileListView
        project={activeProject}
        centerTab={centerTab}
        onCenterTabChange={setCenterTab}
        selectedPaperIds={selectedPaperIds}
        onToggleSelect={togglePaperSelect}
        onClearSelection={() => setSelectedPaperIds(new Set())}
        onAddPaper={handleAddPaper}
        onDeletePaper={handleDeletePaper}
        onUpdateDescription={handleUpdateProjectDescription}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <RightPanel
        project={activeProject}
        tab={rightTab}
        onTabChange={setRightTab}
        selectedPapers={activeProject.papers.filter((p) => selectedPaperIds.has(p.id))}
        activeChatSession={activeChatSession}
        onUpdateChatMessages={handleUpdateChatMessages}
        onNewChat={handleNewChat}
      />
    </div>
  );
}
