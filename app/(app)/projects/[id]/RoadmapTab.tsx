"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";

interface RoadmapItem {
  title: string;
  type: "fix" | "feature" | "improvement";
  impact: "high" | "medium" | "low";
  effort: "small" | "medium" | "large";
  source: "our_complaints" | "competitor_gap" | "our_strength";
  rationale: string;
  evidence: string[];
}
interface Roadmap {
  items: RoadmapItem[];
  summary: string;
  generated_at?: string;
}

const TYPE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  fix: { bg: "var(--neg-wash)", fg: "var(--neg)", label: "Fix" },
  feature: { bg: "var(--accent-wash)", fg: "var(--accent)", label: "Feature" },
  improvement: { bg: "var(--surface-2)", fg: "var(--text-dim)", label: "Improvement" },
};
const SOURCE_LABEL: Record<string, string> = {
  our_complaints: "from our complaints",
  competitor_gap: "competitor gap",
  our_strength: "protect our strength",
};
const IMPACT_COLOR: Record<string, string> = { high: "var(--pos)", medium: "var(--warn)", low: "var(--muted)" };
const EFFORT_SHORT: Record<string, string> = { small: "S", medium: "M", large: "L" };

function Badge({ children, color, dot }: { children: React.ReactNode; color?: string; dot?: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--hairline)", color: color || "var(--muted)", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, display: "inline-block" }} />}
      {children}
    </span>
  );
}

export default function RoadmapTab({ projectId, hasMine }: { projectId: string; hasMine: boolean }) {
  const [data, setData] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/roadmap`).then((r) => r.json()).then((d) => d && setData(d));
  }, [projectId]);

  async function generate() {
    setLoading(true); setErr("");
    const r = await fetch(`/api/projects/${projectId}/roadmap`, { method: "POST" });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    else setData(await r.json());
    setLoading(false);
  }

  function copyMarkdown() {
    if (!data) return;
    const md =
      `# Roadmap\n\n${data.summary}\n\n` +
      data.items
        .map((it, i) =>
          `## ${i + 1}. ${it.title}\n` +
          `- **Type:** ${it.type} · **Impact:** ${it.impact} · **Effort:** ${it.effort} · **Source:** ${SOURCE_LABEL[it.source] || it.source}\n` +
          `- ${it.rationale}\n` +
          it.evidence.map((e) => `  - > ${e}`).join("\n")
        )
        .join("\n\n");
    navigator.clipboard.writeText(md);
  }

  if (!hasMine)
    return <Empty icon="target" title="Assign your extension first">Mark an extension as “Mine” and fetch reviews to generate a roadmap.</Empty>;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 13.5, margin: 0, maxWidth: 560 }}>
          Claude turns your complaints, your strengths, and competitor gaps into a <strong style={{ color: "var(--text)" }}>prioritized, buildable backlog</strong>.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {data && <button className="btn" onClick={copyMarkdown}><Icon.copy size={14} /> Copy markdown</button>}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? <><Spinner /> Building roadmap…</> : data ? "Regenerate" : "Generate roadmap"}
          </button>
        </div>
      </div>
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {!data && !loading && <Empty icon="roadmap" title="No roadmap yet">Fetch reviews for your extension and competitors, then click “Generate roadmap”.</Empty>}

      {data && (
        <div style={{ display: "grid", gap: 12 }}>
          <div className="card" style={{ padding: 18, fontSize: 14.5, lineHeight: 1.6 }}>
            <span className="eyebrow" style={{ color: "var(--accent)", marginRight: 8 }}>Strategy</span>{data.summary}
          </div>

          {data.items.map((it, i) => {
            const ts = TYPE_STYLE[it.type] || TYPE_STYLE.improvement;
            return (
              <div key={i} className="card" style={{ padding: 18, display: "flex", gap: 16 }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 500, color: "var(--faint)", minWidth: 26, textAlign: "right", paddingTop: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{it.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 650, padding: "2px 8px", borderRadius: 6, background: ts.bg, color: ts.fg, textTransform: "uppercase", letterSpacing: ".05em" }}>{ts.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 11 }}>
                    <Badge color={IMPACT_COLOR[it.impact]} dot={IMPACT_COLOR[it.impact]}>{it.impact} impact</Badge>
                    <Badge>{EFFORT_SHORT[it.effort] || "?"} effort</Badge>
                    <Badge>{SOURCE_LABEL[it.source] || it.source}</Badge>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55, marginBottom: it.evidence?.length ? 11 : 0 }}>{it.rationale}</div>
                  {it.evidence?.map((ev, j) => (
                    <div key={j} className="muted" style={{ fontSize: 12.5, paddingLeft: 12, borderLeft: "2px solid var(--hairline)", marginBottom: 5, fontStyle: "italic" }}>“{ev}”</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
