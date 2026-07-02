"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  usePublicData, PublicState, PublicNav, PublicFooter, fmt, type AppCard,
} from "../../public-shared";

function Sparkline({ data, w = 110, h = 28, color = "var(--accent)" }: { data: (number | null)[]; w?: number; h?: number; color?: string }) {
  const pts = data.filter((v): v is number => v != null);
  if (pts.length < 2) return <div style={{ width: w, height: h }} />;
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} style={{ display: "block" }} aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AppTile({ a }: { a: AppCard }) {
  return (
    <Link href={`/p/${a.ext_id}`} style={{ textDecoration: "none" }}>
      <div className="card" style={{ padding: 18, height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          {a.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.icon} alt="" width={44} height={44} style={{ borderRadius: 10, flexShrink: 0, background: "var(--surface-2)" }} />
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--muted)", flexShrink: 0 }}>
              <Icon.puzzle size={20} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="display" style={{ fontSize: 16, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
            {a.category && <div className="muted" style={{ fontSize: 12 }}>{a.category}</div>}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" }}>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Metric label="users" value={a.users || fmt(a.users_num)} />
            <Metric label={`${fmt(a.rating_count)} ratings`} value={a.rating != null ? `${a.rating.toFixed(1)}★` : "—"} />
            {a.metrics?.ga_active_users != null && <Metric label="GA users" value={fmt(a.metrics.ga_active_users)} />}
          </div>
          <Sparkline data={a.sparkline.users} />
        </div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span className="mono" style={{ fontSize: 17, color: "var(--text)" }}>{value}</span>
      <span className="eyebrow">{label}</span>
    </span>
  );
}

export default function PublicAppsPage() {
  const { data, err } = usePublicData();
  const gate = PublicState({ data, err });
  if (gate) return gate;

  const { profile, apps = [] } = data!;

  return (
    <div className="public-wrap fade-in">
      <PublicNav name={profile?.name} />
      <header style={{ marginBottom: 28 }}>
        <h1 className="display" style={{ fontSize: 30 }}>Apps</h1>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>{apps.length} extension{apps.length === 1 ? "" : "s"} shipped.</p>
      </header>

      {apps.length === 0 ? (
        <div className="card-quiet" style={{ padding: 40, textAlign: "center" }}>
          <p className="muted" style={{ fontSize: 13.5 }}>No apps to show yet.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {apps.map((a) => <AppTile key={a.ext_id} a={a} />)}
        </div>
      )}

      <PublicFooter />
    </div>
  );
}
