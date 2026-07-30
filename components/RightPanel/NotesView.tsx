"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/types";
import styles from "./styles.module.css";

interface NotesViewProps {
  project: Project;
}

export default function NotesView({ project }: NotesViewProps) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(`litassist-notes-${project.id}`);
    if (saved !== null) {
      setNotes(saved);
    } else {
      setNotes("");
    }
  }, [project.id]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    localStorage.setItem(`litassist-notes-${project.id}`, val);
  };

  return (
    <>
      <div className={styles.notesHeader}>
        <span className={styles.notesLabel}>PROJECT NOTES</span>
        <span className={styles.notesCount}>{notes.length} chars</span>
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
