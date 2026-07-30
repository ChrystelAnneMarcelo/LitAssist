"use client";

import { MessageSquare, StickyNote, FileText } from "lucide-react";
import type { Project, Paper, RightTab, ChatSession, ChatMessage } from "@/types";
import ChatView from "./ChatView";
import NotesView from "./NotesView";
import styles from "./styles.module.css";

interface RightPanelProps {
  project: Project;
  tab: RightTab;
  onTabChange: (tab: RightTab) => void;
  selectedPapers: Paper[];
  activeChatSession?: ChatSession | null;
  onUpdateChatMessages?: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onNewChat?: () => void;
}

export default function RightPanel({
  project,
  tab,
  onTabChange,
  selectedPapers,
  activeChatSession,
  onUpdateChatMessages,
  onNewChat,
}: RightPanelProps) {
  return (
    <div className={styles.panel}>
      {/* Header tabs */}
      <div className={styles.header}>
        <button
          className={`${styles.tab} ${tab === "ask" ? styles.active : ""}`}
          onClick={() => onTabChange("ask")}
        >
          <MessageSquare size={12} /> Ask AI
        </button>
        <button
          className={`${styles.tab} ${tab === "notes" ? styles.active : ""}`}
          onClick={() => onTabChange("notes")}
        >
          <StickyNote size={12} /> Notes
        </button>

        {selectedPapers.length > 0 && (
          <div className={styles.selectedBadge}>
            <FileText size={9} style={{ color: "var(--primary)" }} />
            <span className={styles.selectedBadgeText}>{selectedPapers.length} selected</span>
          </div>
        )}
      </div>

      {/* Tab content */}
      {tab === "ask" ? (
        <ChatView
          project={project}
          selectedPapers={selectedPapers}
          activeChatSession={activeChatSession}
          onUpdateChatMessages={onUpdateChatMessages}
          onNewChat={onNewChat}
        />
      ) : (
        <NotesView project={project} />
      )}
    </div>
  );
}
