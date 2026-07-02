"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PublicNav, PublicFooter, StatCard, LineChart, BarRow, fmt, chromeUrl } from "../../public-shared";

interface AppDetail {
  ext_id: string; name: string; slug: string; icon: string; category: string;
  rating: number | null; rating_count: number | null; users: string;
  meta: { builtIn: string; prompts: string; price: string; created: string };
  ratingSeries: { date: string; rating: number | null }[];
  usersSeries: { date: string; users: number | null }[];
  ga: {
    activeUsers: number | null; newUsers: number | null; pageViews: number | null; sessions: number | null;
    series: { date: string; activeUsers: number; pageViews: number }[];
    geo: { country: string; users: number }[]; captured_at: string;
  } | null;
}

function Badge({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <span className="card-quiet" style={{ padding: "8px 12px", borderRadius: 8, display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span className="eyebrow">{label}</span>
      <span className="mono" style={{ fontSize: 13, color: "var(--text)" }}>{value}</span>
    </span>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

export default function PublicAppPage({ params }: { params: Promise<{ extId: string }> }) {
  const { extId } = use(params);
  const [data, setData] = useState<{ enabled: boolean; profile?: { name: string }; app?: AppDetail | null } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`/api/public/${extId}`).then((r) => r.json()).then(setData).catch(() => setErr(true));
  }, [extId]);

  if (err) return <div className="public-wrap"><p className="muted">Couldn’t load.</p></div>;
  if (!data) return <div className="public-wrap"><p className="muted">Loading…</p></div>;
  if (!data.enabled) {
    return <div className="public-wrap" style={{ textAlign: "center", paddingTop: 120 }}>
      <div className="display" style={{ fontSize: 22 }}>This page isn’t public yet</div>
    </div>;
  }
  if (!data.app) {
    return <div className="public-wrap"><PublicNav name={data.profile?.name} /><p className="muted">App not found.</p></div>;
  }

  const a = data.app;
  const ga = a.ga;

  return (
    <div className="public-wrap fade-in">
      <PublicNav name={data.profile?.name} />
      <Link href="/p/apps" className="muted" style={{ fontSize: 12.5, textDecoration: "none" }}>← All apps</Link>

      {/* Header */}
      <header style={{ display: "flex", gap: 16, alignItems: "center", margin: "16px 0 18px" }}>
        {a.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.icon} alt="" width={56} height={56} style={{ borderRadius: 12, background: "var(--surface-2)" }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--muted)" }}><Icon.puzzle size={24} /></div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="display" style={{ fontSize: 28 }}>{a.name}</h1>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            {a.category}{a.rating != null ? ` · ${a.rating.toFixed(1)}★ (${fmt(a.rating_count)})` : ""}
          </div>
        </div>
        <a href={chromeUrl(a)} target="_blank" rel="noreferrer" className="btn btn-sm">
          <Icon.external size={14} /> <span style={{ marginLeft: 6 }}>View on store</span>
        </a>
      </header>

      {/* Badges */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 }}>
        <Badge label="Built in" value={a.meta.builtIn} />
        <Badge label="Prompts" value={a.meta.prompts} />
        <Badge label="Price" value={a.meta.price} />
        <Badge label="Category" value={a.category} />
        <Badge label="Created" value={a.meta.created} />
      </div>

      {/* Live stats (Google Analytics) */}
      {ga && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <StatCard label="Active users" value={fmt(ga.activeUsers)} />
            <StatCard label="New users" value={fmt(ga.newUsers)} />
            <StatCard label="Page views" value={fmt(ga.pageViews)} />
            <StatCard label="Sessions" value={fmt(ga.sessions)} />
          </div>
        </section>
      )}

      {/* Charts */}
      {ga && ga.series.length >= 2 && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <ChartCard title="Active users over time">
            <LineChart data={ga.series} metric="activeUsers" color="var(--info)" />
          </ChartCard>
          <ChartCard title="Page views over time">
            <LineChart data={ga.series} metric="pageViews" color="var(--info)" />
          </ChartCard>
        </section>
      )}

      {/* Breakdowns */}
      {ga && ga.geo.length > 0 && (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ChartCard title="Users by region">
            {ga.geo.map((g) => {
              const tot = ga.geo.reduce((s, x) => s + x.users, 0) || 1;
              return <BarRow key={g.country} label={g.country} value={fmt(g.users)} pct={+((g.users / tot) * 100).toFixed(1)} />;
            })}
          </ChartCard>
        </section>
      )}

      {!ga && (
        <div className="card-quiet" style={{ padding: 36, textAlign: "center" }}>
          <p className="muted" style={{ fontSize: 13.5 }}>No analytics for this app yet. Connect Google Analytics in Settings.</p>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
