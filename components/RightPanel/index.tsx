"use client";

import { MessageSquare, FileText, StickyNote } from "lucide-react";
import type { Project, Paper, RightTab, ChatSession, ChatMessage } from "@/types";
import ChatView from "./ChatView";
import NotesView from "./NotesView";
import styles from "./styles.module.css";

interface RightPanelProps {
  project: Project;
  tab?: RightTab;
  onTabChange?: (tab: RightTab) => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
  selectedPapers: Paper[];
  activeChatSession?: ChatSession | null;
  onUpdateChatMessages?: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onNewChat?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
}

export default function RightPanel({
  project,
  tab = "ask",
  onTabChange,
  onUpdateProject,
  selectedPapers,
  activeChatSession,
  onUpdateChatMessages,
  onNewChat,
  selectedModel,
  onModelChange,
}: RightPanelProps) {
  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => onTabChange?.("ask")}
            className={`${styles.tab} ${tab === "ask" ? styles.active : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <MessageSquare size={13} style={{ color: tab === "ask" ? "var(--primary)" : "inherit" }} /> Ask AI
          </button>
          <button
            onClick={() => onTabChange?.("notes")}
            className={`${styles.tab} ${tab === "notes" ? styles.active : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <StickyNote size={13} style={{ color: tab === "notes" ? "var(--primary)" : "inherit" }} /> Notes
          </button>
        </div>

        {tab === "ask" && selectedPapers.length > 0 && (
          <div className={styles.selectedBadge}>
            <FileText size={9} style={{ color: "var(--primary)" }} />
            <span className={styles.selectedBadgeText}>{selectedPapers.length} selected</span>
          </div>
        )}
      </div>

      {/* Ask AI / Notes */}
      {tab === "notes" ? (
        <NotesView project={project} onUpdateProject={onUpdateProject} />
      ) : (
        <ChatView
          project={project}
          selectedPapers={selectedPapers}
          activeChatSession={activeChatSession}
          onUpdateChatMessages={onUpdateChatMessages}
          onNewChat={onNewChat}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
        />
      )}
    </div>
  );
}
