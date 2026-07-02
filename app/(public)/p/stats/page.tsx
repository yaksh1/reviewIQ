"use client";

import {
  usePublicData, PublicState, PublicNav, PublicFooter, StatCard, LineChart, BarRow, fmt,
} from "../../public-shared";

function ChartCard({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div className="eyebrow">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function PublicStatsPage() {
  const { data, err } = usePublicData();
  const gate = PublicState({ data, err });
  if (gate) return gate;

  const { profile, totals, stats } = data!;
  const ga = stats?.ga;

  return (
    <div className="public-wrap fade-in">
      <PublicNav name={profile?.name} />

      <header style={{ marginBottom: 30 }}>
        <h1 className="display" style={{ fontSize: 30 }}>Live stats</h1>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>
          {stats?.hasGa ? `Google Analytics · last ${stats.rangeDays} days` : "Chrome Web Store ratings"}
          {stats?.capturedAt ? ` · updated ${new Date(stats.capturedAt).toLocaleDateString()}` : ""}
        </p>
      </header>

      {/* Top-line store numbers */}
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="Apps" value={fmt(totals?.apps)} />
          <StatCard label="Store users" value={fmt(totals?.users)} />
          <StatCard label="Total ratings" value={fmt(totals?.ratings)} />
          <StatCard label="Avg rating" value={totals?.avgRating != null ? totals.avgRating.toFixed(2) : "—"} />
        </div>
      </section>

      {ga && stats?.hasGa && (
        <>
          <section style={{ marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <StatCard label="Active users" value={fmt(ga.activeUsers)} sub={`last ${stats.rangeDays}d`} />
              <StatCard label="New users" value={fmt(ga.newUsers)} />
              <StatCard label="Page views" value={fmt(ga.pageViews)} />
              <StatCard label="Sessions" value={fmt(ga.sessions)} />
            </div>
          </section>

          {/* Time-series charts */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <ChartCard title="Active users over time">
              <LineChart data={ga.series} metric="activeUsers" />
            </ChartCard>
            <ChartCard title="Page views over time">
              <LineChart data={ga.series} metric="pageViews" color="var(--info)" />
            </ChartCard>
          </section>

          {/* Geo + sources */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <ChartCard title="Top countries">
              {ga.geo.length ? ga.geo.map((g) => (
                <BarRow key={g.country} label={g.country} value={fmt(g.users)} pct={g.pct} />
              )) : <p className="muted" style={{ fontSize: 12.5 }}>No geo data.</p>}
            </ChartCard>
            <ChartCard title="Traffic sources">
              {ga.sources.length ? ga.sources.map((s) => (
                <BarRow key={s.channel} label={s.channel} value={fmt(s.sessions)} pct={s.pct} color="var(--info)" />
              )) : <p className="muted" style={{ fontSize: 12.5 }}>No source data.</p>}
            </ChartCard>
          </section>

          {/* Top pages */}
          {ga.topPages.length > 0 && (
            <section style={{ marginBottom: 14 }}>
              <ChartCard title="Top pages">
                {ga.topPages.map((p) => (
                  <div key={p.path} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <span className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.path}</span>
                    <span className="mono" style={{ fontSize: 12.5, color: "var(--text)", flexShrink: 0 }}>{fmt(p.views)}</span>
                  </div>
                ))}
              </ChartCard>
            </section>
          )}
        </>
      )}

      {!stats?.hasGa && (
        <div className="card-quiet" style={{ padding: 40, textAlign: "center", marginTop: 8 }}>
          <p className="muted" style={{ fontSize: 13.5 }}>
            No analytics yet. Connect Google Analytics in Settings.
          </p>
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
