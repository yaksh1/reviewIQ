"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";

interface ProjectRow {
  id: number;
  name: string;
  description: string;
  ext_count: number;
  review_count: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    fetch("/api/projects").then((r) => r.json()).then(setProjects);
  }
  useEffect(load, []);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    setName(""); setDesc(""); setShowForm(false); setLoading(false);
    load();
  }

  return (
    <div className="fade-in">
      <PageHeader
        title="Projects"
        subtitle="Each project tracks one of your extensions against its competitors."
        right={<button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : <><Icon.plus size={15} /> New project</>}</button>}
      />

      {showForm && (
        <div className="card fade-in" style={{ padding: 20, marginBottom: 24, display: "grid", gap: 11, maxWidth: 560 }}>
          <input className="input" placeholder="Project name (e.g. AdBlock vs competitors)" value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && create()} />
          <input className="input" placeholder="Description (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div>
            <button className="btn btn-primary" onClick={create} disabled={loading || !name.trim()}>Create project</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <Empty icon="projects" title="No projects yet">Create your first project to start tracking extensions.</Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: 20, height: "100%", transition: "border-color .14s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--hairline-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--hairline)")}>
                <div className="display" style={{ fontSize: 17, color: "var(--text)", marginBottom: 5 }}>{p.name}</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 16, minHeight: 18 }}>{p.description || "No description"}</div>
                <div style={{ display: "flex", gap: 18 }}>
                  <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.puzzle size={13} /> <span className="mono">{p.ext_count}</span> extensions
                  </span>
                  <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Icon.chat size={13} /> <span className="mono">{p.review_count}</span> reviews
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
