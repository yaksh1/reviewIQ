"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

/* Shared types, data hook, nav, and small viz used across the public pages. */

export interface AppCard {
  ext_id: string;
  name: string;
  slug: string;
  icon: string;
  category: string;
  website: string;
  rating: number | null;
  rating_count: number | null;
  users: string;
  users_num: number | null;
  review_count: number | null;
  sparkline: { users: (number | null)[]; rating: (number | null)[] };
  metrics: {
    ga_active_users: number | null;
    ga_page_views: number | null;
    ga_geo: { country: string; users: number }[];
  } | null;
}

export interface PublicData {
  enabled: boolean;
  profile?: {
    name: string; tagline: string; goal: string; profit: string; startDate: string;
    youtube: string; twitter: string; website: string;
  };
  totals?: { apps: number; users: number; ratings: number; reviews: number; avgRating: number | null };
  deltas?: { users: number | null; ratings: number | null; reviews: number | null; baselineAt: string | null };
  metrics?: { ga_active_users: number | null; ga_page_views: number | null; hasData: boolean };
  apps?: AppCard[];
  stats?: PublicStats;
}

export interface PublicStats {
  hasGa: boolean;
  rangeDays: number;
  ga: {
    activeUsers: number | null; newUsers: number | null; pageViews: number | null; sessions: number | null;
    series: { date: string; activeUsers: number; pageViews: number }[];
    geo: { country: string; users: number; pct: number }[];
    sources: { channel: string; sessions: number; pct: number }[];
    topPages: { path: string; views: number }[];
  };
  capturedAt: string | null;
}

export function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function usePublicData() {
  const [data, setData] = useState<PublicData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/api/public").then((r) => r.json()).then(setData).catch(() => setErr(true));
  }, []);
  return { data, err };
}

const NAV = [
  { href: "/p", label: "Home" },
  { href: "/p/stats", label: "Live Stats" },
  { href: "/p/apps", label: "Apps" },
];

export function PublicNav({ name }: { name?: string }) {
  const path = usePathname();
  return (
    <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40, gap: 16, flexWrap: "wrap" }}>
      <Link href="/p" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, border: "1px solid var(--hairline-strong)", background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--accent)" }}>
          <Icon.target size={15} />
        </span>
        <span className="display" style={{ fontSize: 15, color: "var(--text)" }}>{name || "Building in public"}</span>
      </Link>
      <div style={{ display: "flex", gap: 4 }}>
        {NAV.map((n) => {
          const active = n.href === "/p" ? path === "/p" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} style={{
              padding: "7px 13px", borderRadius: 8, fontSize: 13, fontWeight: 550, textDecoration: "none",
              color: active ? "var(--text)" : "var(--muted)",
              background: active ? "var(--surface)" : "transparent",
              border: active ? "1px solid var(--hairline)" : "1px solid transparent",
            }}>
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{label}</div>
      <div className="mono" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)" }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

/** Area+line chart from a daily series. Pure SVG, no deps. */
export function LineChart({ data, metric, h = 200, color = "var(--accent)" }: {
  data: { date: string; activeUsers: number; pageViews: number }[];
  metric: "activeUsers" | "pageViews";
  h?: number;
  color?: string;
}) {
  if (data.length < 2) return <div className="muted" style={{ fontSize: 12.5, padding: 24 }}>Not enough data yet.</div>;
  const w = 720;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const vals = data.map((d) => d[metric]);
  const max = Math.max(...vals, 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (data.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[metric]).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(data.length - 1).toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`;
  const firstLabel = data[0].date.slice(5);
  const lastLabel = data[data.length - 1].date.slice(5);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block" }} role="img" aria-label={`${metric} over time`}>
      <defs>
        <linearGradient id={`g-${metric}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${metric})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad.l} y={h - 6} fontSize="10" fill="var(--faint)" className="mono">{firstLabel}</text>
      <text x={w - pad.r} y={h - 6} fontSize="10" fill="var(--faint)" textAnchor="end" className="mono">{lastLabel}</text>
    </svg>
  );
}

/** Horizontal % bar row (geo / sources). */
export function BarRow({ label, value, pct, color = "var(--accent)" }: { label: string; value: string; pct: number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0" }}>
      <span style={{ fontSize: 13, color: "var(--text-dim)", width: 130, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      <div style={{ flex: 1, height: 7, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", width: 84, textAlign: "right", flexShrink: 0 }}>
        {value} · {pct}%
      </span>
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer style={{ marginTop: 64, paddingTop: 20, borderTop: "1px solid var(--hairline)" }}>
      <span className="muted" style={{ fontSize: 11.5 }}>
        Live stats from the Chrome Web Store + Google Analytics. Built with ReviewIQ.
      </span>
    </footer>
  );
}

export function chromeUrl(ext: { slug: string; ext_id: string }): string {
  return `https://chromewebstore.google.com/detail/${ext.slug || "detail"}/${ext.ext_id}`;
}

export function PublicState({ data, err }: { data: PublicData | null; err: boolean }) {
  if (err) return <div className="public-wrap"><p className="muted">Couldn’t load.</p></div>;
  if (!data) return <div className="public-wrap"><p className="muted">Loading…</p></div>;
  if (!data.enabled) {
    return (
      <div className="public-wrap" style={{ textAlign: "center", paddingTop: 120 }}>
        <div className="display" style={{ fontSize: 22, marginBottom: 8 }}>This page isn’t public yet</div>
        <p className="muted" style={{ fontSize: 14 }}>Enable it under Settings → Public profile.</p>
      </div>
    );
  }
  return null;
}
