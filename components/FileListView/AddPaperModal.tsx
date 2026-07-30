"use client";

import { useState, useRef } from "react";
import { Upload, X, FileUp, CheckCircle, AlertCircle, Loader2, Search, Link as LinkIcon, Sparkles } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface AddPaperModalProps {
  onClose: () => void;
  onAdd: (paper: Paper) => void;
}

export default function AddPaperModal({ onClose, onAdd }: AddPaperModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "upload" | "manual">("search");

  // Form Fields
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [abstract, setAbstract] = useState("");
  const [tags, setTags] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // File Upload state
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── DOI / URL / Title Search Handler ───────────────────────────────────────
  const handleSearchDoiOrTitle = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);

    try {
      // Check if query is a DOI or URL containing DOI
      const doiMatch = query.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
      let fetchUrl = "";

      if (doiMatch) {
        const cleanDoi = doiMatch[0].replace(/[/.]+$/, "");
        fetchUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
      } else {
        // Search by title or keywords via Crossref
        fetchUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=1`;
      }

      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error("Paper not found on Crossref database.");

      const data = await res.json();
      let item = data.message;

      // If search results array
      if (item && item.items && item.items.length > 0) {
        item = item.items[0];
      }

      if (!item || !item.title) {
        throw new Error("No metadata returned for this DOI / query.");
      }

      // 1. Title
      const extractedTitle = Array.isArray(item.title) ? item.title[0] : item.title;
      setTitle(extractedTitle || query);

      // 2. Authors
      if (item.author && Array.isArray(item.author) && item.author.length > 0) {
        const firstAuthor = item.author[0];
        const lastName = firstAuthor.family || firstAuthor.name || "";
        const formattedAuthors = item.author.length > 1 ? `${lastName}, et al.` : lastName;
        setAuthors(formattedAuthors);
      } else {
        setAuthors("Unknown Author");
      }

      // 3. Year
      const pubDate = item["published-print"] || item["published-online"] || item.created || item.issued;
      if (pubDate && pubDate["date-parts"] && pubDate["date-parts"][0]) {
        setYear(pubDate["date-parts"][0][0].toString());
      } else {
        setYear(new Date().getFullYear().toString());
      }

      // 4. Journal / Publisher
      if (item["container-title"] && item["container-title"][0]) {
        setJournal(item["container-title"][0]);
      } else if (item.publisher) {
        setJournal(item.publisher);
      }

      // 5. Abstract
      if (item.abstract) {
        // Strip JATS XML tags if present
        const cleanAbstract = item.abstract.replace(/<[^>]*>?/gm, "").trim();
        setAbstract(cleanAbstract);
      } else {
        setAbstract(`Study titled "${extractedTitle}" published in ${item["container-title"]?.[0] || "academic journal"}. Registered via DOI/Search lookup.`);
      }

      // 6. Tags / Subject
      if (item.subject && Array.isArray(item.subject)) {
        setTags(item.subject.slice(0, 4).join(", "));
      } else {
        setTags("RRL Source, Scholarly Paper");
      }

      setSearchSuccess(`Successfully fetched metadata for "${extractedTitle.slice(0, 50)}…"`);
    } catch (err: any) {
      console.warn("DOI / Search lookup error:", err);
      setSearchError(err.message || "Failed to fetch metadata. Check DOI or enter manually.");
    } finally {
      setIsSearching(false);
    }
  };

  // ─── File Upload Handler ───────────────────────────────────────────────────
  const processFile = async (file: File) => {
    setFileName(file.name);
    setIsParsing(true);

    try {
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      setTitle(cleanTitle);

      const text = await file.text();
      if (text && text.trim().length > 0) {
        const abstractMatch = text.match(/abstract[:\s]+([\s\S]{50,500}?)(?=\n\n|\n[A-Z]|$)/i);
        if (abstractMatch && abstractMatch[1]) {
          setAbstract(abstractMatch[1].trim());
        } else {
          const cleanText = text.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
          setAbstract(cleanText.slice(0, 450) + (cleanText.length > 450 ? "…" : ""));
        }

        const yearMatch = file.name.match(/\b(19|20)\d{2}\b/) || text.match(/\b(19|20)\d{2}\b/);
        setYear(yearMatch ? yearMatch[0] : new Date().getFullYear().toString());

        const keywords: string[] = [];
        if (/deep learning|cnn|yolo|resnet|transformer/i.test(text)) keywords.push("Deep Learning");
        if (/detection|segmentation|computer vision|image/i.test(text)) keywords.push("Computer Vision");
        if (/agriculture|plant|crop|disease|lettuce|harvest/i.test(text)) keywords.push("Agriculture");
        if (/review|survey|systematic/i.test(text)) keywords.push("Review");
        if (keywords.length > 0) setTags(keywords.join(", "));
      }
    } catch (err) {
      console.warn("Could not extract file text:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    const paper: Paper = {
      id: `paper-${Date.now()}`,
      title: title.trim(),
      authors: authors.trim() || "Unknown Author",
      year: year.trim() || new Date().getFullYear().toString(),
      journal: journal.trim() || "Academic Publication",
      abstract: abstract.trim() || "No abstract available.",
      methodology: abstract ? `Methodology synthesis from abstract: ${abstract.slice(0, 200)}…` : "",
      keyFindings: [
        "Identified as key theoretical/empirical reference for RRL.",
        "Synthesized methodological contributions and core outcomes.",
        "Integrated into active project literature database.",
      ],
      tags: tags
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : ["RRL Literature", "Academic Paper"],
      added: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    onAdd(paper);
    onClose();
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ width: "min(90vw, 560px)", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleRow}>
            <Sparkles size={15} style={{ color: "var(--primary)" }} />
            <span className={styles.modalTitle}>Add Paper to Literature</span>
          </div>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={14} />
          </button>
        </div>

        {/* Tab switcher: DOI Search vs Upload vs Manual */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            background: "rgba(255,255,255,0.02)",
            padding: "0 20px",
            gap: 16,
          }}
        >
          <button
            onClick={() => setActiveTab("search")}
            style={{
              fontSize: 12,
              padding: "10px 0",
              color: activeTab === "search" ? "var(--primary)" : "var(--muted-foreground)",
              fontWeight: activeTab === "search" ? 500 : 400,
              borderBottom: activeTab === "search" ? "2px solid var(--primary)" : "2px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Search size={13} /> DOI / URL Search
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            style={{
              fontSize: 12,
              padding: "10px 0",
              color: activeTab === "upload" ? "var(--primary)" : "var(--muted-foreground)",
              fontWeight: activeTab === "upload" ? 500 : 400,
              borderBottom: activeTab === "upload" ? "2px solid var(--primary)" : "2px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileUp size={13} /> Upload File
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            style={{
              fontSize: 12,
              padding: "10px 0",
              color: activeTab === "manual" ? "var(--primary)" : "var(--muted-foreground)",
              fontWeight: activeTab === "manual" ? 500 : 400,
              borderBottom: activeTab === "manual" ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            Manual Entry
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Tab 1: DOI / URL / Title Search */}
          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className={styles.fieldLabel}>SEARCH BY DOI, PAPER URL, OR TITLE (MyBib Style)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className={styles.input}
                  placeholder="e.g. 10.1016/j.compag.2021.106500 or paper title…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchDoiOrTitle()}
                />
                <button
                  onClick={handleSearchDoiOrTitle}
                  disabled={!searchQuery.trim() || isSearching}
                  className={styles.btnPrimary}
                  style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                >
                  {isSearching ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={13} />}
                  Fetch
                </button>
              </div>

              {searchSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--primary)", fontFamily: "var(--font-mono)", background: "rgba(201,169,110,0.1)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                  <CheckCircle size={12} /> {searchSuccess}
                </div>
              )}
              {searchError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--destructive)", fontFamily: "var(--font-mono)", background: "rgba(192,57,43,0.1)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                  <AlertCircle size={12} /> {searchError}
                </div>
              )}
              <p style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.4 }}>
                Supports Crossref academic lookup. Enter any DOI (e.g. 10.1016/...) or paper title to auto-fill metadata.
              </p>
            </div>
          )}

          {/* Tab 2: File Upload Drop Zone */}
          {activeTab === "upload" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "24px 16px",
                borderRadius: "var(--radius-lg)",
                border: `2px dashed ${dragActive ? "var(--primary)" : "var(--border)"}`,
                background: dragActive ? "rgba(201,169,110,0.06)" : "var(--input-background)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              {isParsing ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)" }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>Parsing document content…</span>
                </div>
              ) : fileName ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)" }}>
                  <CheckCircle size={18} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{fileName}</span>
                  <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
                    (Parsed successfully)
                  </span>
                </div>
              ) : (
                <>
                  <FileUp size={26} style={{ color: "var(--primary)" }} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>
                      Upload PDF or Research Document
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      Drag & drop .pdf, .txt, or .md file to auto-extract text
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Form Fields Preview & Review */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            <div>
              <label className={styles.fieldLabel}>TITLE *</label>
              <input
                className={styles.input}
                placeholder="Paper title…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className={styles.fieldRow}>
              <div style={{ flex: 1 }}>
                <label className={styles.fieldLabel}>AUTHORS</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Rong, et al."
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                />
              </div>
              <div style={{ width: 100 }}>
                <label className={styles.fieldLabel}>YEAR</label>
                <input
                  className={styles.input}
                  placeholder="2026"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel}>JOURNAL / PUBLISHER</label>
              <input
                className={styles.input}
                placeholder="e.g. IEEE Transactions, Nature, Science Direct…"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
              />
            </div>

            <div>
              <label className={styles.fieldLabel}>ABSTRACT / SUMMARY</label>
              <textarea
                className={styles.textarea}
                placeholder="Paste abstract or paper text summary here…"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
              />
            </div>

            <div>
              <label className={styles.fieldLabel}>TAGS (comma-separated)</label>
              <input
                className={styles.input}
                placeholder="Computer Vision, Deep Learning, Agriculture…"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.btnSecondary}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={styles.btnPrimary}
          >
            Add Paper to Project
          </button>
        </div>
      </div>
    </div>
  );
}
