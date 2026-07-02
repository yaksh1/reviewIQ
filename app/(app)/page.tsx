"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";

interface Stats {
  projects: number;
  extensions: number;
  reviews: number;
  analyses: number;
  replies: number;
  recentProjects: { id: number; name: string; ext_count: number; review_count: number }[];
}

const CARDS = [
  { key: "projects", label: "Projects", icon: Icon.projects },
  { key: "extensions", label: "Extensions tracked", icon: Icon.puzzle },
  { key: "reviews", label: "Reviews fetched", icon: Icon.chat },
  { key: "analyses", label: "AI analyses run", icon: Icon.spark },
] as const;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  return (
    <div className="fade-in">
      <PageHeader
        title="Dashboard"
        subtitle="Chrome Web Store review intelligence across every project you track."
        right={<Link href="/projects" className="btn btn-primary"><Icon.plus size={15} /> New project</Link>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 34 }}>
        {CARDS.map((c) => {
          const I = c.icon;
          return (
            <div key={c.key} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <span className="eyebrow">{c.label}</span>
                <I size={15} style={{ color: "var(--muted)" }} />
              </div>
              <div className="mono" style={{ fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)" }}>
                {stats ? stats[c.key].toLocaleString() : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="display" style={{ fontSize: 18 }}>Recent projects</h2>
        {stats && stats.recentProjects.length > 0 && (
          <Link href="/projects" className="muted" style={{ fontSize: 13, textDecoration: "none" }}>View all →</Link>
        )}
      </div>

      {stats && stats.recentProjects.length === 0 ? (
        <Empty icon="projects" title="No projects yet">
          Create a project, assign your extension and its competitors, then fetch and analyze reviews.
          <div style={{ marginTop: 18 }}>
            <Link href="/projects" className="btn btn-primary">Create your first project</Link>
          </div>
        </Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {stats?.recentProjects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: 18, height: "100%", transition: "border-color .14s" }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--hairline-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--hairline)")}>
                <div className="display" style={{ fontSize: 16, color: "var(--text)", marginBottom: 14 }}>{p.name}</div>
                <div style={{ display: "flex", gap: 18 }}>
                  <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon.puzzle size={13} /> <span className="mono">{p.ext_count}</span> extensions
                  </span>
                  <span className="muted" style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 5 }}>
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
