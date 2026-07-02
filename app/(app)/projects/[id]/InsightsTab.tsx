"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";

interface Insights {
  mine: {
    praises: { theme: string; count: number; example?: string }[];
    complaints: { theme: string; count: number; example?: string }[];
    sentiment: { positive: number; neutral: number; negative: number };
  };
  competitors: {
    praises: { theme: string; count: number }[];
    complaints: { theme: string; count: number }[];
    sentiment: { positive: number; neutral: number; negative: number };
  };
  summary: string;
  generated_at?: string;
}

function SentimentBar({ s }: { s: { positive: number; neutral: number; negative: number } }) {
  return (
    <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
      <div style={{ width: `${s.positive}%`, background: "var(--pos)" }} title={`Positive ${s.positive}%`} />
      <div style={{ width: `${s.neutral}%`, background: "#64748b" }} title={`Neutral ${s.neutral}%`} />
      <div style={{ width: `${s.negative}%`, background: "var(--neg)" }} title={`Negative ${s.negative}%`} />
    </div>
  );
}

function ThemeList({ items, tone }: { items: { theme: string; count: number; example?: string }[]; tone: "good" | "bad" }) {
  const color = tone === "good" ? "var(--pos)" : "var(--neg)";
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 3 }}>
            <span style={{ fontWeight: 600 }}>{it.theme}</span>
            <span className="muted">{it.count}</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(it.count / max) * 100}%`, height: "100%", background: color, opacity: 0.8 }} />
          </div>
          {it.example && <div className="muted" style={{ fontSize: 12, marginTop: 4, fontStyle: "italic" }}>“{it.example}”</div>}
        </div>
      ))}
    </div>
  );
}

export default function InsightsTab({ projectId, hasMine }: { projectId: string; hasMine: boolean }) {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/insights`).then((r) => r.json()).then((d) => d && setData(d));
  }, [projectId]);

  async function generate() {
    setLoading(true); setErr("");
    const r = await fetch(`/api/projects/${projectId}/insights`, { method: "POST" });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    else setData(await r.json());
    setLoading(false);
  }

  if (!hasMine)
    return <Empty icon="target" title="Assign your extension first">Mark an extension as “Mine” to compare its sentiment against competitors.</Empty>;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 13.5, margin: 0, maxWidth: 560 }}>
          Sentiment + top themes for your extension, and consolidated themes across all competitors.
        </p>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? <><Spinner /> Analyzing…</> : data ? "Regenerate" : "Generate insights"}
        </button>
      </div>
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {!data && !loading && <Empty icon="spark" title="No insights yet">Fetch reviews, then click “Generate insights”.</Empty>}

      {data && (
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 18, fontSize: 14.5, lineHeight: 1.6 }}>
            <span className="eyebrow" style={{ color: "var(--accent)", marginRight: 8 }}>Takeaway</span>{data.summary}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {/* Mine */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="badge badge-mine">Mine</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Your extension</span>
              </div>
              <SentimentBar s={data.mine.sentiment} />
              <div className="eyebrow" style={{ color: "var(--pos)", margin: "18px 0 9px" }}>Top praises</div>
              <ThemeList items={data.mine.praises} tone="good" />
              <div className="eyebrow" style={{ color: "var(--neg)", margin: "18px 0 9px" }}>Top complaints</div>
              <ThemeList items={data.mine.complaints} tone="bad" />
            </div>

            {/* Competitors */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="badge badge-comp">Competitors</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Consolidated</span>
              </div>
              <SentimentBar s={data.competitors.sentiment} />
              <div className="eyebrow" style={{ color: "var(--pos)", margin: "18px 0 9px" }}>What they’re praised for</div>
              <ThemeList items={data.competitors.praises} tone="good" />
              <div className="eyebrow" style={{ color: "var(--neg)", margin: "18px 0 9px" }}>What they’re criticized for</div>
              <ThemeList items={data.competitors.complaints} tone="bad" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
