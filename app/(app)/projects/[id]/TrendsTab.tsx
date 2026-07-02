"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";

interface Point {
  captured_at: string;
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  users: string;
  sentiment: { positive: number; neutral: number; negative: number } | null;
  themes: { praises: { theme: string; count: number }[]; complaints: { theme: string; count: number }[] } | null;
}
interface ThemeDelta { theme: string; count: number; delta: number | null }
interface Diff {
  rating_delta: number | null;
  rating_count_delta: number | null;
  review_count_delta: number | null;
  complaints: ThemeDelta[];
  praises: ThemeDelta[];
  from: string | null;
  to: string;
}
interface Series {
  extension_id: number;
  name: string;
  role: "mine" | "competitor";
  icon: string;
  points: Point[];
  diff: Diff | null;
}

function fmtDate(s: string) {
  // sqlite 'YYYY-MM-DD HH:MM:SS' (UTC) → short local date
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Tiny sparkline for a numeric series. */
function Spark({ values, color = "var(--accent)", height = 38 }: { values: (number | null)[]; color?: string; height?: number }) {
  const nums = values.map((v) => (v == null ? null : v));
  const valid = nums.filter((v): v is number => v != null);
  if (valid.length < 2) return <div className="muted" style={{ fontSize: 12, height }}>Need 2+ snapshots</div>;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = max - min || 1;
  const w = 220;
  const step = w / (nums.length - 1);
  const pts = nums.map((v, i) => {
    const y = v == null ? null : height - 4 - ((v - min) / range) * (height - 8);
    return v == null ? null : `${(i * step).toFixed(1)},${y!.toFixed(1)}`;
  }).filter(Boolean) as string[];
  const last = valid[valid.length - 1];
  return (
    <svg width={w} height={height} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {(() => {
        const lastPt = pts[pts.length - 1]?.split(",");
        return lastPt ? <circle cx={lastPt[0]} cy={lastPt[1]} r={3} fill={color} /> : null;
      })()}
    </svg>
  );
}

function DeltaPill({ delta, invert = false }: { delta: number | null; invert?: boolean }) {
  if (delta == null) return <span className="muted" style={{ fontSize: 12 }}>new</span>;
  if (delta === 0) return <span className="muted" style={{ fontSize: 12 }}>±0</span>;
  // For complaints, up is bad; for rating/praise, up is good.
  const good = invert ? delta < 0 : delta > 0;
  const color = good ? "var(--pos)" : "var(--neg)";
  const Arrow = delta > 0 ? Icon.arrowUp : Icon.arrowDown;
  return <span className="mono" style={{ color, fontSize: 12.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}><Arrow size={12} />{Math.abs(delta)}</span>;
}

function Metric({ label, value, spark, sparkColor }: { label: string; value: string; spark: (number | null)[]; sparkColor?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div className="eyebrow">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 500, margin: "4px 0 6px", letterSpacing: "-0.02em", color: "var(--text)" }}>{value}</div>
      <Spark values={spark} color={sparkColor} />
    </div>
  );
}

function ExtCard({ s }: { s: Series }) {
  const last = s.points[s.points.length - 1];
  if (!last) return null;
  const hasThemes = s.diff && (s.diff.complaints.length > 0 || s.diff.praises.length > 0);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        {s.icon
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={s.icon} alt="" width={26} height={26} style={{ borderRadius: 7 }} />
          : <span style={{ color: "var(--muted)" }}><Icon.puzzle size={18} /></span>}
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{s.name}</span>
        <span className={`badge ${s.role === "mine" ? "badge-mine" : "badge-comp"}`}>{s.role}</span>
        <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>{s.points.length} snapshot{s.points.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: hasThemes ? 16 : 0 }}>
        <Metric label="Rating" value={last.rating != null ? `${last.rating}★` : "—"} spark={s.points.map((p) => p.rating)} sparkColor="var(--warn)" />
        <Metric label="Total ratings" value={last.rating_count?.toLocaleString() ?? "—"} spark={s.points.map((p) => p.rating_count)} sparkColor="var(--accent)" />
        <Metric label="Reviews fetched" value={last.review_count?.toLocaleString() ?? "—"} spark={s.points.map((p) => p.review_count)} sparkColor="var(--accent)" />
        <Metric label="Positive sentiment" value={last.sentiment ? `${last.sentiment.positive}%` : "—"} spark={s.points.map((p) => p.sentiment?.positive ?? null)} sparkColor="var(--pos)" />
      </div>

      {/* What changed since last snapshot */}
      {s.diff && s.diff.from && (
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>
            Since {fmtDate(s.diff.from)} → {fmtDate(s.diff.to)}
            <span style={{ display: "inline-flex", gap: 14, marginLeft: 12, fontWeight: 600 }}>
              {s.diff.rating_delta != null && <span className="muted">rating <DeltaPill delta={s.diff.rating_delta} /></span>}
              {s.diff.review_count_delta != null && <span className="muted">reviews <DeltaPill delta={s.diff.review_count_delta} /></span>}
            </span>
          </div>
          {hasThemes && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--neg)", marginBottom: 6 }}>Complaints</div>
                {s.diff.complaints.slice(0, 6).map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: "var(--text-dim)" }}>{t.theme} <span className="muted">({t.count})</span></span>
                    <DeltaPill delta={t.delta} invert />
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pos)", marginBottom: 6 }}>Praises</div>
                {s.diff.praises.slice(0, 6).map((t, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
                    <span style={{ color: "var(--text-dim)" }}>{t.theme} <span className="muted">({t.count})</span></span>
                    <DeltaPill delta={t.delta} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrendsTab({ projectId }: { projectId: string }) {
  const [series, setSeries] = useState<Series[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/trends`)
      .then((r) => r.json())
      .then((d) => { setSeries(d.series); setLoading(false); });
  }, [projectId]);

  if (loading)
    return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>;

  const withData = (series || []).filter((s) => s.points.length > 0);
  const totalSnaps = withData.reduce((a, s) => a + s.points.length, 0);

  if (!withData.length)
    return <Empty icon="trend" title="No snapshots yet">Each time you fetch reviews, a dated snapshot is saved here. Fetch reviews (and run Insights for theme trends), then come back over time to see what moved.</Empty>;

  return (
    <div className="fade-in">
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 16px", maxWidth: 620 }}>
        A snapshot is captured on every fetch. Theme & sentiment trends fill in when you run <strong style={{ color: "var(--text)" }}>Insights</strong>. {totalSnaps} snapshot{totalSnaps !== 1 ? "s" : ""} so far — refetch periodically to build history.
      </p>
      <div style={{ display: "grid", gap: 16 }}>
        {withData.map((s) => <ExtCard key={s.extension_id} s={s} />)}
      </div>
    </div>
  );
}
