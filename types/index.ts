export interface PaperAnalysis {
  summary: string;
  keyFindings: string[];
  methodology: string;
  researchGap: string;
  relevanceScore: number;
  topicRelevanceScore?: number;
  topicRelevanceRationale?: string;
  methodologicalRigorScore?: number;
  methodologicalRigorRationale?: string;
  overallRrlRationale?: string;
  themes: string[];
  analyzedAt?: string;
  trace?: string[];
  latencyMs?: number;
  modelName?: string;
}

export interface PaperVerification {
  matched: boolean;
  source: string | null;
  url: string | null;
  similarity: number;
}

export interface PaperContentCheck {
  passed: boolean;
  reason: string | null;
}

export interface Paper {
  id: string;
  title: string;
  authors: string;
  added: string;
  abstract: string;
  fullText?: string;
  methodology: string;
  keyFindings: string[];
  year: string;
  journal: string;
  tags: string[];
  doi?: string;
  url?: string;
  pdfUrl?: string;
  analysis?: PaperAnalysis | null;
  source?: "doi" | "pdf_upload" | "manual";
  publicationType?: "published" | "preprint" | "thesis" | "working_paper" | "unpublished";
  verification?: PaperVerification | null;
  contentCheck?: PaperContentCheck | null;
}

export interface CriteriaScores {
  depth: number;
  structure: number;
  citations: number;
  scope: number;
}

export interface ReviewResult {
  score: number;
  aiGeneratedScore?: number;
  feedback: string;
  criteriaScores?: CriteriaScores;
  trace: string[];
  latencyMs: number;
  modelName: string;
  tokens: { prompt: number; completion: number; total: number };
  retries: number;
}

export interface Draft {
  text: string;
  reviewResult?: ReviewResult | null;
  updatedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  papers: Paper[];
  createdAt: string;
  description: string;
  notes?: string;
  draft?: Draft;
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
  modelName?: string;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export type CenterTab = "files" | "analyze" | "draft";
export type SidebarTab = "files" | "chats";
export type RightTab = "ask";
