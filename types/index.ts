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

export type CenterTab = "files" | "analyze";
export type SidebarTab = "files" | "chats";
export type RightTab = "ask" | "notes";
