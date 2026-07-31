export interface Paper {
  id: string;
  title: string;
  authors: string;
  added: string;
  abstract: string;
  methodology: string;
  keyFindings: string[];
  year: string;
  journal: string;
  tags: string[];
}

export interface Project {
  id: string;
  name: string;
  papers: Paper[];
  createdAt: string;
  description: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  // Observability metadata (from LangGraph agent pipeline)
  trace?: string[];
  tokens?: { prompt: number; completion: number; total: number };
  reviewScore?: number | null;
  latencyMs?: number;
  retries?: number;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export type CenterTab = "files" | "analyze";
export type SidebarTab = "files" | "chats";
export type RightTab = "ask" | "notes";
