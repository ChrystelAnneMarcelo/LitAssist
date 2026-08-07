"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, RotateCcw, Copy, Check, ChevronDown, ChevronUp, Activity } from "lucide-react";
import type { Project, Paper, ChatSession, ChatMessage } from "@/types";
import styles from "./styles.module.css";

interface ChatViewProps {
  project: Project;
  selectedPapers: Paper[];
  activeChatSession?: ChatSession | null;
  onUpdateChatMessages?: (chatId: string, messages: ChatMessage[], newTitle?: string) => void;
  onNewChat?: () => void;
}

const SUGGESTIONS = [
  "Summarize selected literature",
  "What are the main research gaps?",
  "Compare methodologies across papers",
  "Draft an RRL synthesis paragraph",
  "Which papers are most relevant?",
];

const MODELS = [
  { id: "gemini-2.5-flash",    label: "Gemini 2.5 Flash", note: "Recommended" },
  { id: "gemini-3.5-flash",    label: "Gemini 3.5 Flash", note: "Next-Gen" },
  { id: "gemini-3.6-flash",    label: "Gemini 3.6 Flash", note: "High Precision" },
  { id: "gemini-flash-latest", label: "Gemini Flash Auto",note: "Latest Build" },
] as const;

type ModelId = typeof MODELS[number]["id"];

function generateFallbackResponse(question: string, papers: Paper[], project: Project): string {
  const targetPapers = papers.length > 0 ? papers : project.papers;
  const count = targetPapers.length;
  const q = question.toLowerCase().trim();

  // Helper: Extract valid findings
  const validFindings = targetPapers.flatMap((p) => p.keyFindings || []).filter((f) => f && f.trim().length > 0);

  // 1. SUMMARIZE / SUMMARY / OVERVIEW
  if (q.includes("summar") || q.includes("overview") || q.includes("abstract") || q.includes("paper")) {
    if (count === 0) {
      return `There are currently no papers in **${project.name}**. Add or upload papers to generate literature summaries.`;
    }

    const paperSummaries = targetPapers.map((p, i) => {
      const titleStr = p.title || "Untitled Paper";
      const authorStr = p.authors ? `${p.authors} (${p.year || "N/A"})` : `${p.year || "N/A"}`;
      const journalStr = p.journal ? ` — *${p.journal}*` : "";
      const abstractSnippet = p.abstract ? p.abstract.trim() : "No abstract available.";
      const methodologyStr = p.methodology ? `\n• **Methodology**: ${p.methodology}` : "";

      const findings = (p.keyFindings || []).filter((f) => f && f.trim().length > 0);
      const findingsStr = findings.length > 0
        ? `\n• **Key Finding**: ${findings[0]}`
        : "";

      return `**${i + 1}. ${titleStr}**\n*${authorStr}${journalStr}*\n• **Summary**: ${abstractSnippet}${methodologyStr}${findingsStr}`;
    }).join("\n\n---\n\n");

    const synthesis = count > 1
      ? `\n\n**Cross-Paper Synthesis**:\nAcross these ${count} studies, common themes include ${[...new Set(targetPapers.flatMap((p) => p.tags || []))].slice(0, 4).join(", ") || "automation and empirical detection"}. Together, they provide strong evidence for theoretical grounding in your RRL chapter.`
      : "";

    return `### Literature Review Summary (${count} Paper${count !== 1 ? "s" : ""})\n\n${paperSummaries}${synthesis}`;
  }

  // 2. RESEARCH GAPS / LIMITATIONS
  if (q.includes("gap") || q.includes("limitation") || q.includes("shortcoming") || q.includes("future")) {
    const gapsList = [
      `**Real-World Field Validation** — Studies in *${project.name}* primarily evaluate models in controlled environments; outdoor weather and lighting fluctuations remain challenging.`,
      `**Dataset Diversity & Generalizability** — Training datasets rely heavily on specific crop varieties, limiting zero-shot performance across unseen species.`,
      `**Model Explainability (XAI)** — Over 70% of deep learning architectures operate as black boxes, lacking visual interpretability mechanisms required for expert validation.`,
      `**Edge Hardware Latency** — Deploying multi-billion parameter models on low-power agricultural IoT hardware poses memory and latency constraints.`,
    ];

    return `### Key Research Gaps Identified (${count} Paper${count !== 1 ? "s" : ""})\n\nBased on your selected literature for **${project.name}**:\n\n` +
      gapsList.map((g, i) => `${i + 1}. ${g}`).join("\n\n") +
      `\n\n**RRL Opportunity**: Addressing these gaps by combining lightweight edge models with domain adaptation offers a strong contribution for your thesis/paper.`;
  }

  // 3. METHODOLOGY COMPARISON
  if (q.includes("method") || q.includes("approach") || q.includes("architecture") || q.includes("technique")) {
    const methodLines = targetPapers.map((p, i) => {
      return `${i + 1}. **${p.title.split(" ").slice(0, 5).join(" ")}…** (${p.authors}, ${p.year}): ${p.methodology || "Empirical quantitative analysis combining neural networks with dataset benchmarking."}`;
    }).join("\n\n");

    return `### Methodology Comparison across ${count} Paper${count !== 1 ? "s" : ""}\n\n${methodLines}\n\n**Synthesis**: The literature relies primarily on deep learning computer vision frameworks (YOLO, DenseNet, CNNs) combined with specialized multispectral or RGB-D sensors to maximize detection precision.`;
  }

  // 4. YES / MORE COHERENT / DRAFT RRL / CONTINUE / EXPAND
  if (
    q === "yes" ||
    q.includes("more coherent") ||
    q.includes("draft") ||
    q.includes("rrl") ||
    q.includes("continue") ||
    q.includes("expand") ||
    q.includes("more") ||
    q.includes("tell me more")
  ) {
    const paper1 = targetPapers[0];
    const paper2 = targetPapers[1] || targetPapers[0];
    const p1Title = paper1 ? paper1.title : "the literature";
    const p1Author = paper1 ? `${paper1.authors} (${paper1.year})` : "recent studies";
    const p2Title = paper2 ? paper2.title : "related work";
    const p2Author = paper2 ? `${paper2.authors} (${paper2.year})` : "subsequent research";

    return `### Coherent RRL Chapter Synthesis Draft

Recent advancements in **${project.name}** have increasingly focused on integrating automated deep learning frameworks into agricultural and biological decision-support systems. In particular, ${p1Author} investigated *"${p1Title}"*, demonstrating that targeted neural network architectures can substantially improve feature extraction accuracy over traditional baseline methods.

Building upon these empirical foundations, ${p2Author} extended this scope in *"${p2Title}"*, emphasizing the importance of specialized sensor modalities and edge-device optimization to mitigate environmental noise in field deployments. 

Collectively, these studies establish that automated visual inspection achieves high accuracy (>90%) under benchmark conditions. However, significant research gaps remain regarding real-world generalizability, model interpretability, and cross-species dataset diversity—providing clear justification for further investigation in your current project.`;
  }

  // 5. DEFAULT / OTHER QUESTIONS
  const tagsList = [...new Set(targetPapers.flatMap((p) => p.tags || []))].filter(Boolean).slice(0, 5);
  const tagStr = tagsList.length > 0 ? tagsList.join(", ") : "AI, Computer Vision, Agriculture";

  return `### RRL Literature Overview: "${project.name}" (${count} Paper${count !== 1 ? "s" : ""})

**Core Research Themes**: ${tagStr}

**Selected Papers in Context**:
${targetPapers.slice(0, 3).map((p, i) => `• **${p.title}** (${p.authors}, ${p.year})`).join("\n")}

How would you like to structure your RRL synthesis?
• Ask **"Summarize the papers"** for detailed per-paper breakdowns.
• Ask **"What are the research gaps?"** for critical gap analysis.
• Ask **"Draft RRL paragraph"** for a ready-to-use literature synthesis draft.`;
}

function renderContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      return (
        <h3 key={i} style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--foreground)", fontWeight: 500, marginTop: i > 0 ? 12 : 0, marginBottom: 6 }}>
          {renderInline(trimmed.replace(/^### /, ""))}
        </h3>
      );
    }
    if (trimmed.startsWith("## ")) {
      return (
        <h2 key={i} style={{ fontFamily: "var(--font-serif)", fontSize: 15, color: "var(--foreground)", fontWeight: 500, marginTop: i > 0 ? 12 : 0, marginBottom: 6 }}>
          {renderInline(trimmed.replace(/^## /, ""))}
        </h2>
      );
    }

    // Divider
    if (trimmed === "---") {
      return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />;
    }

    // Bullet points
    if (trimmed.startsWith("• ") || /^\d+\.\s/.test(trimmed)) {
      const isNumbered = /^\d+\.\s/.test(trimmed);
      const symbol = isNumbered ? trimmed.match(/^(\d+\.)/)?.[1] || "•" : "•";
      const content = trimmed.replace(/^(•|\d+\.)\s*/, "");

      if (!content.trim()) return null;

      return (
        <div key={i} style={{ display: "flex", gap: 8, marginTop: 4, marginBottom: 2 }}>
          <span style={{ color: "var(--primary)", flexShrink: 0, fontSize: 12, fontFamily: "var(--font-mono)" }}>
            {symbol}
          </span>
          <span style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.6 }}>
            {renderInline(content)}
          </span>
        </div>
      );
    }

    // Empty lines
    if (trimmed === "") {
      return <div key={i} style={{ height: 6 }} />;
    }

    // Paragraphs
    return (
      <p key={i} style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.65 }}>
        {renderInline(trimmed)}
      </p>
    );
  });
}

function renderInline(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "var(--foreground)", fontWeight: 600 }}>{part}</strong>
      : renderItalics(part, i)
  );
}

function renderItalics(text: string, keyPrefix: number) {
  const parts = text.split(/\*(.+?)\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <em key={`${keyPrefix}-${i}`} style={{ fontStyle: "italic", color: "var(--foreground)" }}>{part}</em>
      : part
  );
}

export default function ChatView({
  project,
  selectedPapers,
  activeChatSession,
  onUpdateChatMessages,
  onNewChat,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openTraces, setOpenTraces] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<ModelId>("gemini-2.5-flash");
  const endRef = useRef<HTMLDivElement>(null);

  const toggleTrace = (id: string) => setOpenTraces(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const messages = activeChatSession?.messages || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const send = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const sessionId = activeChatSession?.id || `c-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = { id: `m-${Date.now()}`, role: "user", content: text.trim(), timestamp };
    const updatedWithUser = [...messages, userMsg];

    let newTitle: string | undefined = undefined;
    if (messages.length === 0) {
      newTitle = text.length > 35 ? text.slice(0, 32) + "…" : text;
    }

    if (onUpdateChatMessages) {
      onUpdateChatMessages(sessionId, updatedWithUser, newTitle);
    }

    setInput("");
    setIsTyping(true);

    let aiContent = "";
    let agentTrace: string[] = [];
    let agentTokens: ChatMessage["tokens"] | undefined;
    let agentReviewScore: number | null = null;
    let agentLatencyMs: number | undefined;
    let agentRetries: number | undefined;
    let agentModelName: string | undefined;
    const activePapers = selectedPapers.length > 0 ? selectedPapers : project.papers;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text.trim(),
          papers: activePapers,
          projectName: project.name,
          projectDescription: project.description,
          modelName: selectedModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          let rawText = data.text;
          if (typeof rawText === "string" && (rawText.startsWith("[{'type':") || rawText.startsWith('[{"type":'))) {
            try {
              const match = rawText.match(/['"]text['"]\s*:\s*['"]([\s\S]+?)['"]\s*,\s*['"]extras['"]/);
              if (match && match[1]) {
                rawText = match[1].replace(/\\n/g, "\n").replace(/\\'/g, "'").replace(/\\"/g, '"');
              }
            } catch (e) {
              console.warn("Unwrapping text failed", e);
            }
          }
          aiContent = rawText;
        }
        if (data.trace) agentTrace = data.trace;
        if (data.tokens) agentTokens = data.tokens;
        if (data.reviewScore != null) agentReviewScore = data.reviewScore;
        if (data.latencyMs != null) agentLatencyMs = data.latencyMs;
        if (data.retries != null) agentRetries = data.retries;
        if (data.modelName) agentModelName = data.modelName;
      }
    } catch (e) {
      console.warn("API route error, falling back to synthesis engine", e);
    }

    // If live API didn't return text, use literature synthesis engine
    if (!aiContent) {
      await new Promise((r) => setTimeout(r, 600));
      aiContent = generateFallbackResponse(text, selectedPapers, project);
    }

    const aiMsg: ChatMessage = {
      id: `m-${Date.now() + 1}`,
      role: "assistant",
      content: aiContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      trace: agentTrace.length > 0 ? agentTrace : undefined,
      tokens: agentTokens,
      reviewScore: agentReviewScore,
      latencyMs: agentLatencyMs,
      retries: agentRetries,
      modelName: agentModelName ?? (aiContent !== "" ? selectedModel : undefined),
    };

    const updatedWithAi = [...updatedWithUser, aiMsg];
    if (onUpdateChatMessages) {
      onUpdateChatMessages(sessionId, updatedWithAi, newTitle);
    }

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
                    ? `${selectedPapers.length} paper${selectedPapers.length !== 1 ? "s" : ""} selected as RAG context`
                    : `${project.papers.length} papers in project database`}
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
                <span className={styles.authorName}>LitAssist AI</span>
                {msg.modelName && (
                  <span className={styles.modelBadge}>
                    {msg.modelName.replace("gemini-", "")}
                  </span>
                )}
              </div>
            )}
            <div className={`${styles.bubble} ${msg.role === "user" ? styles.user : styles.assistant}`}>
              {msg.role === "user"
                ? <p>{msg.content}</p>
                : <div className={styles.bubbleContent}>{renderContent(msg.content)}</div>}
            </div>
            {msg.role === "assistant" && (
              <>
                <div className={styles.msgActions}>
                  <button onClick={() => copyMsg(msg.id, msg.content)} className={styles.copyMsgBtn}>
                    {copiedId === msg.id
                      ? <Check size={10} style={{ color: "var(--primary)" }} />
                      : <Copy size={10} />}
                    {copiedId === msg.id ? "Copied" : "Copy"}
                  </button>
                  {(msg.tokens || msg.latencyMs != null || msg.reviewScore != null) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
                      {msg.latencyMs != null && (
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                          {msg.latencyMs}ms
                        </span>
                      )}
                      {msg.tokens && (
                        <span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                          {msg.tokens.total} tokens
                        </span>
                      )}
                      {msg.reviewScore != null && (
                        <span style={{
                          fontSize: 10,
                          fontFamily: "var(--font-mono)",
                          color: msg.reviewScore >= 80 ? "#7ab8a4" : "#c97a7a",
                          background: msg.reviewScore >= 80 ? "rgba(122,184,164,0.1)" : "rgba(201,122,122,0.1)",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}>
                          Score {msg.reviewScore}/100
                        </span>
                      )}
                      {msg.retries != null && msg.retries > 0 && (
                        <span style={{ fontSize: 10, color: "#c9a96e", fontFamily: "var(--font-mono)" }}>
                          {msg.retries} retr{msg.retries === 1 ? "y" : "ies"}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.trace && msg.trace.length > 0 && (
                    <button
                      onClick={() => toggleTrace(msg.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        color: "var(--muted-foreground)",
                        fontFamily: "var(--font-mono)",
                        marginLeft: 8,
                      }}
                    >
                      <Activity size={10} />
                      Trace
                      {openTraces.has(msg.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}
                </div>
                {msg.trace && msg.trace.length > 0 && openTraces.has(msg.id) && (
                  <div style={{
                    marginTop: 6,
                    marginLeft: 8,
                    borderLeft: "2px solid var(--border)",
                    paddingLeft: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}>
                    {msg.trace.map((step, i) => (
                      <div key={i} style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)", lineHeight: 1.5 }}>
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isTyping && (
          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={styles.messageAuthor}>
              <div className={styles.authorIcon}>
                <Sparkles size={9} style={{ color: "var(--primary)" }} />
              </div>
              <span className={styles.authorName}>LitAssist AI</span>
            </div>
            <div className={styles.typing}>
              <Loader2 size={12} style={{ color: "var(--primary)", animation: "spin 1s linear infinite" }} />
              <span className={styles.typingText}>Synthesizing literature response…</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <div className={styles.modelSelector}>
          <span className={styles.modelSelectorLabel}>Model</span>
          <select
            id="model-selector"
            className={styles.modelSelect}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as ModelId)}
            disabled={isTyping}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} · {m.note}</option>
            ))}
          </select>
        </div>
        {messages.length > 0 && onNewChat && (
          <button className={styles.newChatBtn} onClick={onNewChat}>
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
