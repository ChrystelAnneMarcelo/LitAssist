"use client";

import { useState } from "react";
import { INITIAL_PROJECTS } from "@/data/initialProjects";
import type { Project, Paper, CenterTab, SidebarTab, RightTab } from "@/types";
import LeftSidebar from "@/components/LeftSidebar";
import FileListView from "@/components/FileListView";
import RightPanel from "@/components/RightPanel";
import styles from "./styles.module.css";

export default function AppShell() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>("p1");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");
  const [centerTab, setCenterTab] = useState<CenterTab>("files");
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [rightTab, setRightTab] = useState<RightTab>("ask");

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const togglePaperSelect = (id: string) => {
    setSelectedPaperIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setSelectedPaperIds(new Set());
    setCenterTab("files");
  };

  const handleAddProject = (name: string) => {
    const newProject: Project = {
      id: `p${Date.now()}`,
      name,
      description: "",
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      papers: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    setCenterTab("files");
  };

  const handleAddPaper = (paper: Paper) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId ? { ...p, papers: [...p.papers, paper] } : p
      )
    );
  };

  return (
    <div className={styles.shell}>
      <LeftSidebar
        projects={projects}
        activeProjectId={activeProjectId}
        sidebarTab={sidebarTab}
        onTabChange={setSidebarTab}
        onSelectProject={handleSelectProject}
        onAddProject={handleAddProject}
      />

      <FileListView
        project={activeProject}
        centerTab={centerTab}
        onCenterTabChange={setCenterTab}
        selectedPaperIds={selectedPaperIds}
        onToggleSelect={togglePaperSelect}
        onClearSelection={() => setSelectedPaperIds(new Set())}
        onAddPaper={handleAddPaper}
      />

      <RightPanel
        project={activeProject}
        tab={rightTab}
        onTabChange={setRightTab}
        selectedPapers={activeProject.papers.filter((p) =>
          selectedPaperIds.has(p.id)
        )}
      />
    </div>
  );
}
