"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import {
  usePublicData, PublicState, PublicNav, PublicFooter, StatCard, fmt,
} from "../public-shared";

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const start = new Date(iso);
  if (isNaN(start.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000));
}

export default function PublicHome() {
  const { data, err } = usePublicData();
  const gate = PublicState({ data, err });
  if (gate) return gate;

  const { profile, totals, metrics, apps = [] } = data!;
  const days = profile?.startDate ? daysSince(profile.startDate) : null;

  const banner = [
    { label: "Apps", value: fmt(totals?.apps) },
    { label: "Store users", value: fmt(totals?.users) },
    metrics?.hasData ? { label: "Active users", value: fmt(metrics.ga_active_users) } : null,
    profile?.profit ? { label: "Profit", value: profile.profit } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const links = [
    profile?.website && { href: profile.website, label: "Website" },
    profile?.youtube && { href: profile.youtube, label: "YouTube" },
    profile?.twitter && { href: profile.twitter, label: "X / Twitter" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="public-wrap fade-in">
      <PublicNav name={profile?.name} />

      {/* Global banner: apps · users · installs · profit */}
      <div style={{ display: "flex", gap: 0, flexWrap: "wrap", marginBottom: 36, border: "1px solid var(--hairline)", borderRadius: 10, overflow: "hidden" }}>
        {banner.map((b, i) => (
          <div key={b.label} style={{ flex: "1 1 0", minWidth: 120, padding: "12px 16px", borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
            <div className="eyebrow" style={{ marginBottom: 5 }}>{b.label}</div>
            <div className="mono" style={{ fontSize: 19, color: "var(--text)" }}>{b.value}</div>
          </div>
        ))}
      </div>

      {/* Hero */}
      <header style={{ marginBottom: 44 }}>
        <div className="eyebrow" style={{ color: "var(--accent-100)", marginBottom: 14 }}>Building in public</div>
        <h1 className="display" style={{ fontSize: 44, lineHeight: 1.05, maxWidth: 760 }}>
          {profile?.tagline || `${profile?.name || "I"} am building Chrome extensions in public`}
        </h1>
        {(profile?.goal || days != null) && (
          <p className="muted" style={{ fontSize: 15, marginTop: 16, lineHeight: 1.5 }}>
            {profile?.name ? `${profile.name} · ` : ""}
            {profile?.goal ? `Goal: ${profile.goal}` : ""}
            {profile?.goal && days != null ? " · " : ""}
            {days != null ? `Day ${days.toLocaleString()}` : ""}
          </p>
        )}
        {links.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
            {links.map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="btn btn-sm">
                <Icon.external size={14} /> <span style={{ marginLeft: 6 }}>{l.label}</span>
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Headline stats */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <StatCard label="Apps" value={fmt(totals?.apps)} />
          <StatCard label="Store users" value={fmt(totals?.users)} />
          {metrics?.hasData
            ? <StatCard label="Active users" value={fmt(metrics.ga_active_users)} />
            : <StatCard label="Total ratings" value={fmt(totals?.ratings)} />}
          <StatCard label="Avg rating" value={totals?.avgRating != null ? totals.avgRating.toFixed(2) : "—"} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Link href="/p/stats" className="muted" style={{ fontSize: 13, textDecoration: "none" }}>
            See full live stats →
          </Link>
        </div>
      </section>

      {/* Apps preview */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="eyebrow">Apps</div>
          {apps.length > 4 && <Link href="/p/apps" className="muted" style={{ fontSize: 13, textDecoration: "none" }}>View all →</Link>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          {apps.slice(0, 4).map((a) => (
            <Link key={a.ext_id} href={`/p/${a.ext_id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: 18, display: "flex", gap: 13, alignItems: "center" }}>
                {a.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.icon} alt="" width={40} height={40} style={{ borderRadius: 9, flexShrink: 0, background: "var(--surface-2)" }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 9, background: "var(--surface-2)", display: "grid", placeItems: "center", color: "var(--muted)" }}>
                    <Icon.puzzle size={18} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="display" style={{ fontSize: 15, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                  <div className="muted mono" style={{ fontSize: 12, marginTop: 3 }}>
                    {a.users || fmt(a.users_num)} users · {a.rating != null ? `${a.rating.toFixed(1)}★` : "—"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
