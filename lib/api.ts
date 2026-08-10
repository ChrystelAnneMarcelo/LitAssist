/**
 * lib/api.ts
 * Client for the Python FastAPI + MongoDB backend (backend/main.py).
 *
 * All calls go directly from the browser to the backend (CORS is already
 * enabled there for localhost:3000) — set NEXT_PUBLIC_BACKEND_URL in
 * .env.local to point at a deployed backend instead of localhost:8000.
 *
 * Every function throws on a non-2xx response so callers can catch and
 * show an error state rather than silently getting `undefined`.
 */
import type { Project, Paper, PaperAnalysis, Draft, ChatSession, ChatMessage } from "@/types";

// Always use relative `/api` in dev to ensure same-origin cookies by default.
// If you really need to target an external backend, set `NEXT_PUBLIC_BACKEND_URL`
// to an absolute URL. By default prefer `/api` so Next.js rewrites/proxy works.
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL && process.env.NEXT_PUBLIC_BACKEND_URL.startsWith("http")
  ? process.env.NEXT_PUBLIC_BACKEND_URL
  : "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`API ${options?.method || "GET"} ${path} failed (${res.status}): ${detail}`);
  }
  if (res.status === 204) return undefined as T; // no content (deletes)
  return res.json();
}

// ─── Auth ───────────────────────────────────────────────────
export async function signup(email: string, password: string): Promise<{ token: string; email: string }> {
  const res = await request<{ email: string }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // server sets httpOnly cookie; verify server session before storing client state
  await request("/auth/me");
  localStorage.setItem("litassist-email", res.email);
  return { token: "", email: res.email };
}

export async function login(email: string, password: string): Promise<{ token: string; email: string }> {
  const res = await request<{ email: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // Ensure the server-side session cookie is recognized before updating UI state
  await request("/auth/me");
  localStorage.setItem("litassist-email", res.email);
  return { token: "", email: res.email };
}

export async function logout(): Promise<void> {
  try {
    await request<void>("/auth/logout", { method: "POST" });
  } catch (err) {
    // still clear client-side email
  }
  localStorage.removeItem("litassist-email");
}

// ─── Projects ────────────────────────────────────────────────
export function fetchProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export function createProject(name: string, description: string): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export function updateProjectApi(id: string, updates: { name?: string; description?: string }): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteProjectApi(id: string): Promise<void> {
  return request<void>(`/projects/${id}`, { method: "DELETE" });
}

export function saveNotesApi(projectId: string, notes: string): Promise<{ notes: string }> {
  return request(`/projects/${projectId}/notes`, {
    method: "PUT",
    body: JSON.stringify({ notes }),
  });
}

export function saveDraftApi(projectId: string, draft: Draft): Promise<Draft> {
  return request(`/projects/${projectId}/draft`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
}

// ─── Papers ──────────────────────────────────────────────────
export function addPaperApi(projectId: string, paper: Omit<Paper, "id">): Promise<Paper> {
  return request<Paper>(`/projects/${projectId}/papers`, {
    method: "POST",
    body: JSON.stringify(paper),
  });
}

export function updatePaperApi(projectId: string, paperId: string, paper: Omit<Paper, "id">): Promise<Paper> {
  return request<Paper>(`/projects/${projectId}/papers/${paperId}`, {
    method: "PATCH",
    body: JSON.stringify(paper),
  });
}

export function deletePaperApi(projectId: string, paperId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/papers/${paperId}`, { method: "DELETE" });
}

export function savePaperAnalysisApi(
  projectId: string,
  paperId: string,
  analysis: PaperAnalysis
): Promise<Paper> {
  return request<Paper>(`/projects/${projectId}/papers/${paperId}/analysis`, {
    method: "PATCH",
    body: JSON.stringify(analysis),
  });
}

// ─── Chats ───────────────────────────────────────────────────
export function fetchChats(): Promise<ChatSession[]> {
  return request<ChatSession[]>("/chats");
}

export function createChatApi(projectId: string, title: string): Promise<ChatSession> {
  return request<ChatSession>("/chats", {
    method: "POST",
    body: JSON.stringify({ projectId, title }),
  });
}

export function deleteChatApi(id: string): Promise<void> {
  return request<void>(`/chats/${id}`, { method: "DELETE" });
}

export function addMessageApi(chatId: string, message: Omit<ChatMessage, "id">): Promise<ChatMessage> {
  return request<ChatMessage>(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify(message),
  });
}
