"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Save, AlertCircle } from "lucide-react";
import type { Project } from "@/types";
import { saveNotesApi } from "@/lib/api";
import styles from "./styles.module.css";

interface NotesViewProps {
  project: Project;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => void;
}

const SAVE_DEBOUNCE_MS = 800;

export default function NotesView({ project, onUpdateProject }: NotesViewProps) {
  const [notes, setNotes] = useState(project.notes ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload from the project record whenever the active project changes
  // (backend is now the source of truth, not localStorage).
  useEffect(() => {
    setNotes(project.notes ?? "");
    setSaveStatus("idle");
  }, [project.id]);

  const persistNotes = (value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveNotesApi(project.id, value);
        onUpdateProject?.(project.id, { notes: value });
        setSaveStatus("saved");
      } catch (err) {
        console.warn("Failed to save notes:", err);
        setSaveStatus("error");
      }
    }, SAVE_DEBOUNCE_MS);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    persistNotes(val);
  };

  return (
    <>
      <div className={styles.notesHeader}>
        <span className={styles.notesLabel}>PROJECT NOTES</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saveStatus !== "idle" && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: saveStatus === "error" ? "#c77" : "var(--muted-foreground)",
              }}
            >
              {saveStatus === "saving" && (
                <>
                  <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
                  Saving…
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Save size={10} style={{ color: "var(--primary)" }} />
                  Saved
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle size={10} />
                  Save failed
                </>
              )}
            </span>
          )}
          <span className={styles.notesCount}>{notes.length} chars</span>
        </div>
      </div>
      <textarea
        className={styles.notesTextarea}
        value={notes}
        onChange={handleChange}
        placeholder={`Notes for "${project.name}"…\n\nUse this space for:\n• Key insights\n• Research gaps to explore\n• Citation reminders\n• Draft RRL sentences`}
      />
    </>
  );
}
