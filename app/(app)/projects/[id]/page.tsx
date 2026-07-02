"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Tabs, Spinner } from "@/components/ui";
import ExtensionsTab from "./ExtensionsTab";
import ReviewsTab from "./ReviewsTab";
import PositioningTab from "./PositioningTab";
import InsightsTab from "./InsightsTab";
import RoadmapTab from "./RoadmapTab";
import PageIdeasTab from "./PageIdeasTab";
import DirectoryKitTab from "./DirectoryKitTab";
import TrendsTab from "./TrendsTab";
import type { Extension } from "@/lib/types";

export interface ExtWithCount extends Extension {
  review_count: number;
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<{ name: string; description: string; months_back: number } | null>(null);
  const [exts, setExts] = useState<ExtWithCount[]>([]);
  const [tab, setTab] = useState("extensions");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/projects/${id}`);
    const data = await r.json();
    setProject(data.project);
    setExts(data.extensions);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const mine = exts.find((e) => e.role === "mine");

  if (loading)
    return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spinner size={28} /></div>;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 12 }}>
        <Link href="/projects" className="muted" style={{ fontSize: 12.5, textDecoration: "none", letterSpacing: "0.01em" }}>← Projects</Link>
      </div>
      <h1 className="display" style={{ fontSize: 30, marginBottom: 6 }}>{project?.name}</h1>
      <p className="muted" style={{ margin: "0 0 26px", fontSize: 14, maxWidth: 620, lineHeight: 1.5 }}>{project?.description || "Assign your extension and competitors, fetch reviews, then analyze."}</p>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "extensions", label: "Extensions" },
          { key: "reviews", label: "Reviews & Replies" },
          { key: "insights", label: "Insights" },
          { key: "trends", label: "Trends" },
          { key: "roadmap", label: "Roadmap" },
          { key: "ideas", label: "Page Ideas" },
          { key: "directory", label: "Directory Kit" },
          { key: "positioning", label: "Positioning" },
        ]}
      />

      {tab === "extensions" && (
        <ExtensionsTab
          projectId={id}
          exts={exts}
          reload={load}
          monthsBack={project?.months_back ?? 2}
        />
      )}
      {tab === "reviews" && <ReviewsTab projectId={id} mine={mine} />}
      {tab === "insights" && <InsightsTab projectId={id} hasMine={!!mine} />}
      {tab === "trends" && <TrendsTab projectId={id} />}
      {tab === "roadmap" && <RoadmapTab projectId={id} hasMine={!!mine} />}
      {tab === "ideas" && <PageIdeasTab mine={mine} />}
      {tab === "directory" && <DirectoryKitTab mine={mine} />}
      {tab === "positioning" && <PositioningTab projectId={id} hasMine={!!mine} />}
    </div>
  );
}
