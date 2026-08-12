"use client";

import { useState, useRef } from "react";
import { Upload, X, FileUp, CheckCircle, AlertCircle, Loader2, Search, Sparkles } from "lucide-react";
import type { Paper } from "@/types";
import styles from "./styles.module.css";

interface AddPaperModalProps {
  onClose: () => void;
  onAdd: (paper: Paper) => void;
}

export default function AddPaperModal({ onClose, onAdd }: AddPaperModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "upload">("search");

  // Form Fields
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [journal, setJournal] = useState("");
  const [abstract, setAbstract] = useState("");
  const [fullText, setFullText] = useState("");
  const [methodology, setMethodology] = useState("");
  const [keyFindings, setKeyFindings] = useState<string[]>([]);
  const [tags, setTags] = useState("");

  const [doi, setDoi] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchSuccess, setSearchSuccess] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [noAbstractWarning, setNoAbstractWarning] = useState(false);

  // File Upload state
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── DOI / URL / Title Search Handler ────────────────────────
  const handleSearchDoiOrTitle = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchSuccess(null);
    setNoAbstractWarning(false);

    try {
      const res = await fetch("/api/resolve-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: query }),
      });

      if (!res.ok) throw new Error("Could not resolve paper metadata online.");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.title) setTitle(data.title);
      if (data.authors) setAuthors(data.authors);
      if (data.year) setYear(data.year);
      if (data.journal) setJournal(data.journal);
      if (data.abstract) {
        setAbstract(data.abstract);
      } else {
        setAbstract("");
        setNoAbstractWarning(true);
      }
      if (data.methodology) setMethodology(data.methodology);
      if (data.key_findings && Array.isArray(data.key_findings) && data.key_findings.length > 0) {
        setKeyFindings(data.key_findings);
      }
      if (data.tags && Array.isArray(data.tags)) setTags(data.tags.join(", "));
      if (data.doi) setDoi(data.doi);
      if (data.url) setPaperUrl(data.url);
      if (data.pdf_url) setPdfUrl(data.pdf_url);
      if (data.full_text) setFullText(data.full_text);

      const msg = `Successfully resolved "${data.title.slice(0, 45)}…" online!${data.full_text ? " (Full paper text extracted)" : data.pdf_url ? " (Direct Open-Access link found)" : ""}`;
      setSearchSuccess(msg);
    } catch (err: any) {
      console.warn("DOI online resolution error, attempting direct Crossref fallback:", err);
      try {
        const doiMatch = query.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
        const fetchUrl = doiMatch
          ? `https://api.crossref.org/works/${encodeURIComponent(doiMatch[0].replace(/[/.]+$/, ""))}`
          : `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=1`;

        const fallbackRes = await fetch(fetchUrl);
        if (!fallbackRes.ok) throw new Error("Paper not found on academic databases.");

        const fallbackData = await fallbackRes.json();
        let item = fallbackData.message;
        if (item && item.items && item.items.length > 0) item = item.items[0];

        if (item && item.title) {
          const extTitle = Array.isArray(item.title) ? item.title[0] : item.title;
          setTitle(extTitle || query);
          if (item.author && item.author.length > 0) {
            const first = item.author[0];
            const lastName = first.family || first.name || "";
            setAuthors(item.author.length > 1 ? `${lastName}, et al.` : lastName);
          }
          const pubDate = item["published-print"] || item["published-online"] || item.created || item.issued;
          if (pubDate?.["date-parts"]?.[0]) setYear(pubDate["date-parts"][0][0].toString());
          if (item["container-title"]?.[0]) setJournal(item["container-title"][0]);

          if (item.abstract) {
            const cleanAb = item.abstract.replace(/<[^>]*>?/gm, "").replace(/^abstract[—:\s\.\-]*/i, "").trim();
            setAbstract(cleanAb);
            setFullText(cleanAb);
          } else {
            setAbstract("");
            setFullText("");
            setNoAbstractWarning(true);
          }
          setSearchSuccess(`Fetched metadata for "${extTitle.slice(0, 45)}…"`);
        } else {
          throw new Error("No metadata returned.");
        }
      } catch (fallbackErr: any) {
        setSearchError("Failed to resolve DOI online. Please check the DOI and try again.");
      }
    } finally {
      setIsSearching(false);
    }
  };

  // ─── File Upload Handler (PDF + TXT + MD) ──────────────────────
  const processFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setFileName(file.name);
    setIsParsing(true);

    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

    if (isPdf) {
      // Send PDF to Python FastAPI parser via /api/parse-pdf
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to extract text from PDF");
        }

        if (data.title) setTitle(data.title);
        if (data.authors) setAuthors(data.authors);
        if (data.abstract) setAbstract(data.abstract);
        if (data.full_text) setFullText(data.full_text);
        if (data.full_text) setFullText(data.full_text);
        if (data.year) setYear(data.year);
        if (data.journal) setJournal(data.journal);
        if (data.methodology) setMethodology(data.methodology);
        if (data.key_findings && Array.isArray(data.key_findings) && data.key_findings.length > 0) {
          setKeyFindings(data.key_findings);
        }

        // Auto-generate tags based on content
        const text = `${data.title} ${data.abstract}`;
        const keywords: string[] = [];
        if (/deep learning|cnn|yolo|resnet|transformer/i.test(text)) keywords.push("Deep Learning");
        if (/detection|segmentation|computer vision|image/i.test(text)) keywords.push("Computer Vision");
        if (/agriculture|plant|crop|disease|lettuce|harvest/i.test(text)) keywords.push("Agriculture");
        if (/review|survey|systematic/i.test(text)) keywords.push("Review");
        setTags(keywords.length > 0 ? keywords.join(", ") : "PDF Upload, RRL Source");

        setUploadSuccess(`Successfully extracted ${data.num_pages} page(s) from PDF!`);
      } catch (err: any) {
        console.warn("PDF extraction error:", err);
        setUploadError(err.message || "Failed to parse PDF. Please verify Python backend is running.");
      } finally {
        setIsParsing(false);
      }
    } else {
      // Plain text / Markdown file processing
      try {
        const cleanTitle = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        setTitle(cleanTitle);

        const text = await file.text();
        if (text && text.trim().length > 0) {
          setFullText(text);
          const abstractMatch = text.match(/abstract[:\s]+([\s\S]{50,800}?)(?=\n\n|\n[A-Z]|introduction|keywords|$)/i);
          if (abstractMatch && abstractMatch[1]) {
            setAbstract(abstractMatch[1].trim());
          } else {
            const cleanText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, " ").replace(/\s+/g, " ").trim();
            setAbstract(cleanText.slice(0, 600) + (cleanText.length > 600 ? "…" : ""));
          }

          const yearMatch = file.name.match(/\b(19|20)\d{2}\b/) || text.match(/\b(19|20)\d{2}\b/);
          setYear(yearMatch ? yearMatch[0] : new Date().getFullYear().toString());

          const keywords: string[] = [];
          if (/deep learning|cnn|yolo|resnet|transformer/i.test(text)) keywords.push("Deep Learning");
          if (/detection|segmentation|computer vision|image/i.test(text)) keywords.push("Computer Vision");
          if (/agriculture|plant|crop|disease|lettuce|harvest/i.test(text)) keywords.push("Agriculture");
          if (/review|survey|systematic/i.test(text)) keywords.push("Review");
          if (keywords.length > 0) setTags(keywords.join(", "));
          setUploadSuccess("Parsed plain text file successfully!");
        }
      } catch (err) {
        console.warn("Could not extract file text:", err);
        setUploadError("Could not read text file content.");
      } finally {
        setIsParsing(false);
      }
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
      fullText: fullText.trim() || undefined,
      methodology: methodology.trim() || (abstract ? abstract.slice(0, 280) + "…" : "Methodology details not specified."),
      keyFindings: keyFindings.length > 0 ? keyFindings : [
        "Identified as key theoretical/empirical reference for RRL.",
        "Synthesized methodological contributions and core outcomes.",
        "Integrated into active project literature database.",
      ],
      tags: tags
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : ["RRL Literature", "Academic Paper"],
      added: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      doi: doi || undefined,
      url: paperUrl || undefined,
      pdfUrl: pdfUrl || undefined,
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

        {/* Tab switcher: DOI Search vs Upload */}
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
            <FileUp size={13} /> Upload File (.pdf, .txt, .md)
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Tab 1: DOI / URL / Title Search */}
          {activeTab === "search" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className={styles.fieldLabel}>SEARCH BY DOI, PAPER URL, OR TITLE</label>
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

              {searchSuccess && !noAbstractWarning && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--primary)", fontFamily: "var(--font-mono)", background: "rgba(201,169,110,0.1)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                  <CheckCircle size={12} /> {searchSuccess}
                </div>
              )}

              {/* No-abstract warning */}
              {noAbstractWarning && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#e67e22", fontFamily: "var(--font-mono)", background: "rgba(230,126,34,0.08)", border: "1px solid rgba(230,126,34,0.25)", padding: "8px 10px", borderRadius: "var(--radius)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertCircle size={12} />
                    <strong>No abstract available from Crossref.</strong>
                  </div>
                  <span>
                    This paper's abstract is not publicly indexed. To enable AI summarisation and comparison, please paste the abstract text into the <strong>Abstract / Summary</strong> field below.
                  </span>
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

          {/* Tab 2: File Upload Drop Zone (PDF + TXT + MD) */}
          {activeTab === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                  border: `2px dashed ${dragActive ? "var(--primary)" : uploadError ? "var(--destructive)" : "var(--border)"}`,
                  background: dragActive ? "rgba(201,169,110,0.06)" : "var(--input-background)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {isParsing ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)" }}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>Parsing PDF document…</span>
                  </div>
                ) : fileName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--primary)" }}>
                    <CheckCircle size={18} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{fileName}</span>
                  </div>
                ) : (
                  <>
                    <FileUp size={26} style={{ color: "var(--primary)" }} />
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 13, color: "var(--foreground)", fontWeight: 500 }}>
                        Upload PDF or Research Document
                      </p>
                      <p style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                        Drag & drop .pdf, .txt, or .md file to auto-extract text & abstract
                      </p>
                    </div>
                  </>
                )}
              </div>

              {uploadSuccess && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--primary)", fontFamily: "var(--font-mono)", background: "rgba(201,169,110,0.1)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                  <CheckCircle size={12} /> {uploadSuccess}
                </div>
              )}

              {uploadError && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--destructive)", fontFamily: "var(--font-mono)", background: "rgba(192,57,43,0.1)", padding: "6px 10px", borderRadius: "var(--radius)" }}>
                  <AlertCircle size={12} /> {uploadError}
                </div>
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
              <label className={styles.fieldLabel}>
                ABSTRACT / SUMMARY
                {noAbstractWarning && (
                  <span style={{ color: "#e67e22", marginLeft: 6, fontWeight: 600 }}>
                    ← Paste abstract here to enable AI synthesis
                  </span>
                )}
              </label>
              <textarea
                className={styles.textarea}
                placeholder={noAbstractWarning
                  ? "No abstract was found on Crossref. Paste the abstract text here to enable AI summarisation and comparison…"
                  : "Paste abstract or paper text summary here…"
                }
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                style={noAbstractWarning ? { borderColor: "#e67e22" } : {}}
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
