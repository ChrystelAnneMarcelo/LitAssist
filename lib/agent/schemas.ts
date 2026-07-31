import { z } from "zod";

// ─── Input schemas ──────────────────────────────────────────
export const PaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.string(),
  year: z.string().or(z.number()),
  journal: z.string().optional().default(""),
  abstract: z.string().optional().default(""),
  methodology: z.string().optional().default(""),
  keyFindings: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export const ChatInputSchema = z.object({
  question: z.string().min(1, "Question cannot be empty"),
  papers: z.array(PaperSchema).optional().default([]),
  projectName: z.string().optional().default("Literature Review"),
});

// ─── Node output schemas ─────────────────────────────────────
export const ReviewOutputSchema = z.object({
  score: z.number().min(0).max(100),
  feedback: z.string(),
  approved: z.boolean(),
});

// ─── Final API response schema ───────────────────────────────
export const AgentResponseSchema = z.object({
  text: z.string(),
  trace: z.array(z.string()),
  reviewScore: z.number(),
  tokens: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
  }),
  latencyMs: z.number(),
  retries: z.number(),
});

export type Paper = z.infer<typeof PaperSchema>;
export type ChatInput = z.infer<typeof ChatInputSchema>;
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
