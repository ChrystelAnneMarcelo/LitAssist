"use client";

import type { Project } from "@/types";
import styles from "./styles.module.css";

interface NotesViewProps {
  project: Project;
}

export default function NotesView({ project }: NotesViewProps) {
  return (
    <>
      <div className={styles.notesHeader}>
        <span className={styles.notesLabel}>PROJECT NOTES</span>
      </div>
      <textarea
        className={styles.notesTextarea}
        placeholder={`Notes for "${project.name}"…\n\nUse this space for:\n• Key insights\n• Research gaps to explore\n• Citation reminders\n• Draft RRL sentences`}
        defaultValue=""
      />
    </>
  );
}
