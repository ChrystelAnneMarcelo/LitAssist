"use client";

import { MessageSquare, FileText } from "lucide-react";
import type { Project, Paper, RightTab, ChatSession, ChatMessage } from "@/types";
import ChatView from "./ChatView";
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
          <div className={`${styles.tab} ${styles.active}`}>
            <MessageSquare size={13} style={{ color: "var(--primary)" }} /> Ask AI
          </div>
        </div>

        {selectedPapers.length > 0 && (
          <div className={styles.selectedBadge}>
            <FileText size={9} style={{ color: "var(--primary)" }} />
            <span className={styles.selectedBadgeText}>{selectedPapers.length} selected</span>
          </div>
        )}
      </div>

      <ChatView
        project={project}
        selectedPapers={selectedPapers}
        activeChatSession={activeChatSession}
        onUpdateChatMessages={onUpdateChatMessages}
        onNewChat={onNewChat}
        selectedModel={selectedModel}
        onModelChange={onModelChange}
      />
    </div>
  );
}
