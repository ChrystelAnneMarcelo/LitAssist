"use client";

import { useState, useRef } from "react";
import { Upload, X, FileUp, CheckCircle, AlertCircle, Loader2, Search, Sparkles, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { Paper, PaperVerification, PaperContentCheck } from "@/types";
import styles from "./styles.module.css";

interface AddPaperModalProps {
  onClose: () => void;
  onAdd: (paper: Paper) => void;
}

const PUBLICATION_TYPES = [
  { value: "published", label: "Published" },
  { value: "preprint", label: "Preprint" },
  { value: "thesis", label: "Thesis or Dissertation" },
  { value: "working_paper", label: "Working Paper" },
  { value: "unpublished", label: "Unpublished" },
] as const;

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

  // Source verification state — set once, at fetch/upload time only
  const [source, setSource] = useState<"doi" | "pdf_upload" | "manual">("manual");
  const [publicationType, setPublicationType] = useState<
    "published" | "preprint" | "thesis" | "working_paper" | "unpublished"
  >("published");
  const [verification, setVerification] = useState<PaperVerification | null>(null);
  const [contentCheck, setContentCheck] = useState<PaperContentCheck | null>(null);
  // Holds a low-confidence match's full data when auto-fill is withheld —
  // lets the user review and explicitly opt in, instead of either silently
  // trusting it (the original bug) or discarding it entirely (dead end,
  // no path forward if they don't already know the exact title/DOI).
  const [candidateResult, setCandidateResult] = useState<any | null>(null);

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
    setVerification(null);
    setCandidateResult(null);

    try {
      const res = await fetch("/api/resolve-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: query }),
      });

      if (!res.ok) throw new Error("Could not resolve paper metadata online.");

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Guard against the exact bug we found: a fuzzy-search fallback can
      // return a REAL but UNRELATED paper as its closest guess. If the
      // backend says it doesn't confidently match what was searched for,
      // don't auto-fill the form with someone else's real metadata —
      // require the user to explicitly decide what to do next instead.
      const gotDifferentTitle = data.title && data.title.trim().toLowerCase() !== query.trim().toLowerCase();
      const matchFailed = gotDifferentTitle && data.verification && data.verification.matched === false;

      if (matchFailed) {
        // Don't auto-fill — but don't throw the data away either. Surface
        // it as a suggestion the user can consciously accept or dismiss.
        setCandidateResult(data);
        setSearchSuccess(null);
        return;
      }

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
      if (data.verification) setVerification(data.verification);
      setSource("doi");
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
          const isExactDoiLookup = Boolean(doiMatch);
          const gotDifferentTitle = extTitle && extTitle.trim().toLowerCase() !== query.trim().toLowerCase();

          // Same guard as the primary path above: this fallback's `else`
          // branch (no doiMatch) is a fuzzy Crossref text search, which
          // returns its closest guess regardless of how unrelated it is.
          // No real similarity check is available client-side here, so
          // rather than risk a false "matched: true" claim, treat any
          // fuzzy-search result with a different title as unconfirmed —
          // same as the primary path's protection.
          if (!isExactDoiLookup && gotDifferentTitle) {
            const authorsStr =
              item.author && item.author.length > 0
                ? item.author.length > 1
                  ? `${item.author[0].family || item.author[0].name || ""}, et al.`
                  : item.author[0].family || item.author[0].name || ""
                : "";
            const pubDate = item["published-print"] || item["published-online"] || item.created || item.issued;
            const yearStr = pubDate?.["date-parts"]?.[0]?.[0]?.toString() || "";
            const journalStr = item["container-title"]?.[0] || "";
            const abstractStr = item.abstract
              ? item.abstract.replace(/<[^>]*>?/gm, "").replace(/^abstract[—:\s\.\-]*/i, "").trim()
              : "";

            // No real similarity score available client-side for this
            // fallback path — surface it as an unconfirmed candidate
            // rather than fabricate a percentage we can't actually back up.
            setCandidateResult({
              title: extTitle,
              authors: authorsStr,
              year: yearStr,
              journal: journalStr,
              abstract: abstractStr,
              doi: item.DOI || undefined,
              url: item.DOI ? `https://doi.org/${item.DOI}` : undefined,
              verification: { matched: false, source: null, url: null, similarity: 0 },
            });
            return;
          }

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
          // Only reachable now via an exact DOI lookup (isExactDoiLookup),
          // so a confident match claim is actually justified here.
          setVerification({
            matched: true,
            source: "Crossref",
            url: item.DOI ? `https://doi.org/${item.DOI}` : null,
            similarity: 1.0,
          });
          setSource("doi");
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

  // Explicit opt-in: the user reviewed a low-confidence candidate and
  // decided to use it anyway. Applies the same fields the primary/fallback
  // paths would have auto-filled, now as a deliberate choice instead of a
  // silent default.
  const applyCandidateResult = () => {
    if (!candidateResult) return;
    const data = candidateResult;
    if (data.title) setTitle(data.title);
    if (data.authors) setAuthors(data.authors);
    if (data.year) setYear(data.year);
    if (data.journal) setJournal(data.journal);
    if (data.abstract) {
      setAbstract(data.abstract);
      setNoAbstractWarning(false);
    } else {
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
    setVerification(data.verification || null);
    setSource("doi");
    setSearchSuccess(`Applied "${data.title.slice(0, 45)}…" — please double-check the fields below.`);
    setCandidateResult(null);
  };

  // ─── File Upload Handler (PDF + TXT + MD) ──────────────────────
  const processFile = async (file: File) => {
    setUploadError(null);
    setUploadSuccess(null);
    setFileName(file.name);
    setIsParsing(true);
    setVerification(null);
    setContentCheck(null);

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
        if (data.year) setYear(data.year);
        if (data.journal) setJournal(data.journal);
        if (data.methodology) setMethodology(data.methodology);
        if (data.key_findings && Array.isArray(data.key_findings) && data.key_findings.length > 0) {
          setKeyFindings(data.key_findings);
        }
        if (data.content_check) setContentCheck(data.content_check);
        if (data.verification) setVerification(data.verification);
        setSource("pdf_upload");

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
      source,
      publicationType,
      // Verification only means something for Published/Preprint — thesis/
      // working-paper/unpublished are self-reported by design (see the
      // badge logic above), so don't attach an index-match result to them.
      verification: publicationType === "published" || publicationType === "preprint" ? verification : null,
      contentCheck: contentCheck,
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

              {/* Low-confidence match — shown as an explicit opt-in suggestion,
                  not auto-applied. This is the fix for the bug where a
                  fuzzy search silently trusted an unrelated real paper. */}
              {candidateResult && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    background: "var(--input-background)",
                    border: "1px solid var(--border)",
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "var(--muted-foreground)" }}>
                    <ShieldQuestion size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>
                      Closest result found — not a confident match
                      {candidateResult.verification?.similarity > 0 && (
                        <> ({Math.round(candidateResult.verification.similarity * 100)}% similar)</>
                      )}
                      . Review before using it.
                    </span>
                  </div>
                  <div style={{ paddingLeft: 19 }}>
                    <div style={{ color: "var(--foreground)", fontWeight: 500 }}>{candidateResult.title}</div>
                    <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
                      {candidateResult.authors || "Unknown authors"}
                      {candidateResult.year && ` · ${candidateResult.year}`}
                      {candidateResult.journal && ` · ${candidateResult.journal}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, paddingLeft: 19 }}>
                    <button
                      onClick={applyCandidateResult}
                      style={{
                        fontSize: 10.5,
                        padding: "4px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--primary)",
                        color: "var(--primary)",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Use This Result
                    </button>
                    <button
                      onClick={() => setCandidateResult(null)}
                      style={{
                        fontSize: 10.5,
                        padding: "4px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        color: "var(--muted-foreground)",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

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
              <label className={styles.fieldLabel}>PUBLICATION TYPE</label>
              <select
                className={styles.input}
                value={publicationType}
                onChange={(e) => setPublicationType(e.target.value as typeof publicationType)}
              >
                {PUBLICATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginTop: 4, lineHeight: 1.4 }}>
                {publicationType === "published" || publicationType === "preprint"
                  ? "Checked against academic indexes (Crossref, arXiv, Semantic Scholar, PubMed, OpenAlex)."
                  : "Self-reported — not checked against indexes, since this type of work usually isn't indexed."}
              </p>
            </div>

            {/* Source verification badge — appears once a fetch/upload has actually run */}
            {(verification || contentCheck) && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  padding: "8px 10px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "var(--input-background)",
                }}
              >
                {contentCheck && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: contentCheck.passed ? "var(--primary)" : "#e67e22" }}>
                    {contentCheck.passed ? <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <ShieldAlert size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span>{contentCheck.passed ? "PDF content looks like a real document." : contentCheck.reason}</span>
                  </div>
                )}
                {verification && (publicationType === "published" || publicationType === "preprint") && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: verification.matched ? "var(--primary)" : "var(--muted-foreground)" }}>
                    {verification.matched ? <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <ShieldQuestion size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                    {verification.matched ? (
                      <span>
                        Found in {verification.source}
                        {verification.url && (
                          <> — <a href={verification.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>view record</a></>
                        )}
                      </span>
                    ) : (
                      <span>
                        Not independently indexed
                        {verification.similarity > 0 ? (
                          <> — closest result was only {Math.round(verification.similarity * 100)}% similar, below the confidence threshold.</>
                        ) : (
                          <> (no confident match across Crossref, arXiv, Semantic Scholar, PubMed, OpenAlex).</>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {verification && (publicationType === "thesis" || publicationType === "working_paper" || publicationType === "unpublished") && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "var(--muted-foreground)" }}>
                    <ShieldQuestion size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>Self-reported, not independently indexed — expected for this publication type.</span>
                  </div>
                )}
              </div>
            )}

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