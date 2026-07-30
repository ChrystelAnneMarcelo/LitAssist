"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, RotateCcw, Copy, Check, FileText, ChevronDown } from "lucide-react";
import type { Project, Paper } from "@/types";
import styles from "./styles.module.css";

interface ChatViewProps {
  project: Project;
  selectedPapers: Paper[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What are the main research gaps?",
  "Summarize the methodologies used",
  "Compare key findings across papers",
  "What themes emerge from this literature?",
  "Which papers are most relevant to my RRL?",
];

function generateResponse(question: string, papers: Paper[], project: Project): string {
  const allPapers = papers.length > 0 ? papers : project.papers;
  const count = allPapers.length;
  const themes = [...new Set(allPapers.flatMap((p) => p.tags))].slice(0, 5);
  const q = question.toLowerCase();

  if (q.includes("gap")) {
    return `Based on ${count} paper${count !== 1 ? "s" : ""} in **${project.name}**, key **research gaps** include:\n\n1. **Geographic scope** — Most studies use controlled greenhouse environments.\n2. **Dataset diversity** — Cross-species validation is rare.\n3. **Explainability** — 73% of systems lack interpretability mechanisms.\n4. **Longitudinal evaluation** — Follow-up periods are typically short (<6 months).`;
  }
  if (q.includes("method")) {
    const methods = allPapers.map((p) => p.methodology).filter(Boolean).slice(0, 3);
    return `**Methodologies** across ${count} papers:\n\n${methods.map((m, i) => `${i + 1}. ${m}`).join("\n\n")}\n\nDeep learning with CNN architectures dominates. Transfer learning from COCO/ImageNet is common to address limited agricultural datasets.`;
  }
  if (q.includes("theme") || q.includes("topic")) {
    return `**Emerging themes** in "${project.name}":\n\n${themes.map((t, i) => `${i + 1}. **${t}** — A recurring focus across multiple studies.`).join("\n")}\n\nThese suggest the field converges around automated detection and edge deployment.`;
  }
  if (q.includes("relevant") || q.includes("rrl")) {
    return allPapers.slice(0, 3).map((p, i) => `${i + 1}. **${p.title}** (${p.authors}, ${p.year})\n   — Covers ${p.tags.slice(0, 2).join(" and ")}.`).join("\n\n");
  }
  if (q.includes("summar") || q.includes("finding")) {
    const findings = allPapers.flatMap((p) => p.keyFindings).slice(0, 5);
    return `**Key findings** from ${count} papers:\n\n${findings.map((f) => `• ${f}`).join("\n")}\n\nOverall: AI-based methods achieve >90% accuracy in controlled conditions but vary in field settings.`;
  }
  return `Based on **${count} paper${count !== 1 ? "s" : ""}** in "${project.name}":\n\nThemes include ${themes.join(", ")}. Would you like me to focus on research gaps, methodology comparison, or thematic analysis?`;
}

function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("• ") || /^\d+\. /.test(line)) {
      const bullet = line.startsWith("• ") ? "•" : line.match(/^(\d+)\./)?.[1] + ".";
      const content = line.replace(/^[•\d]+[.] /, "");
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{ color: "var(--primary)", flexShrink: 0, fontSize: 12 }}>{bullet}</span>
          <span>{renderInline(content)}</span>
        </div>
      );
    }
    if (line === "") return <div key={i} style={{ height: 6 }} />;
    return <p key={i}>{renderInline(line)}</p>;
  });
}

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "var(--foreground)", fontWeight: 600 }}>{part}</strong>
      : part
  );
}

export default function ChatView({ project, selectedPapers }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => { setMessages([]); setInput(""); }, [project.id]);

  const send = async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: ChatMessage = { id: `m${Date.now()}`, role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 800));
    const aiMsg: ChatMessage = {
      id: `m${Date.now() + 1}`,
      role: "assistant",
      content: generateResponse(text, selectedPapers, project),
    };
    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const copyMsg = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Context indicator */}
      {selectedPapers.length > 0 && (
        <div className={styles.contextBar}>
          <ChevronDown size={10} style={{ color: "var(--primary)", transform: "rotate(-90deg)" }} />
          <span className={styles.contextText}>
            Context: {selectedPapers.length} paper{selectedPapers.length !== 1 ? "s" : ""}
          </span>
          <div className={styles.contextDots}>
            {selectedPapers.slice(0, 3).map((_, i) => <div key={i} className={styles.dot} />)}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && !isTyping && (
          <div className={styles.emptyState}>
            <div className={styles.emptyHeader}>
              <div className={styles.emptyIcon}>
                <Sparkles size={18} style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className={styles.emptyTitle}>Ask about your literature</p>
                <p className={styles.emptyHint}>
                  {selectedPapers.length > 0
                    ? `${selectedPapers.length} paper${selectedPapers.length !== 1 ? "s" : ""} selected`
                    : `${project.papers.length} papers in this project`}
                </p>
              </div>
            </div>

            <p className={styles.suggestionsLabel}>SUGGESTED</p>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((q) => (
                <button key={q} className={styles.suggestionBtn} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`${styles.messageRow} ${msg.role === "user" ? styles.user : styles.assistant}`}>
            {msg.role === "assistant" && (
              <div className={styles.messageAuthor}>
                <div className={styles.authorIcon}>
                  <Sparkles size={9} style={{ color: "var(--primary)" }} />
                </div>
                <span className={styles.authorName}>LitAssist</span>
              </div>
            )}
            <div className={`${styles.bubble} ${msg.role === "user" ? styles.user : styles.assistant}`}>
              {msg.role === "user"
                ? <p>{msg.content}</p>
                : <div className={styles.bubbleContent}>{renderContent(msg.content)}</div>}
            </div>
            {msg.role === "assistant" && (
              <div className={styles.msgActions}>
                <button onClick={() => copyMsg(msg.id, msg.content)} className={styles.copyMsgBtn}>
                  {copiedId === msg.id
                    ? <Check size={10} style={{ color: "var(--primary)" }} />
                    : <Copy size={10} />}
                  {copiedId === msg.id ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={styles.messageAuthor}>
              <div className={styles.authorIcon}>
                <Sparkles size={9} style={{ color: "var(--primary)" }} />
              </div>
              <span className={styles.authorName}>LitAssist</span>
            </div>
            <div className={styles.typing}>
              <Loader2 size={12} style={{ color: "var(--primary)", animation: "spin 1s linear infinite" }} />
              <span className={styles.typingText}>Analyzing literature…</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        {messages.length > 0 && (
          <button className={styles.newChatBtn} onClick={() => setMessages([])}>
            <RotateCcw size={9} /> New chat
          </button>
        )}
        <div className={styles.inputBox}>
          <textarea
            className={styles.inputTextarea}
            value={input}
            rows={1}
            placeholder="Ask about your papers…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <button
            className={styles.sendBtn}
            onClick={() => send(input)}
            disabled={!input.trim() || isTyping}
            style={{
              background: input.trim() ? "var(--primary)" : "var(--muted)",
              color: input.trim() ? "var(--primary-foreground)" : "var(--muted-foreground)",
            }}
          >
            <Send size={12} />
          </button>
        </div>
        <p className={styles.inputHint}>Enter to send · Shift+Enter for newline</p>
      </div>
    </>
  );
}
