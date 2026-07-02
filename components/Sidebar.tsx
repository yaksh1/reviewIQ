"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

const NAV = [
  { href: "/", label: "Dashboard", icon: Icon.dashboard },
  { href: "/projects", label: "Projects", icon: Icon.projects },
  { href: "/settings", label: "Settings", icon: Icon.cog },
];

const PROVIDER_LABEL: Record<string, string> = {
  "claude-cli": "local · claude -p",
  anthropic: "anthropic api",
  "openai-compatible": "openai-compatible",
};

export default function Sidebar() {
  const path = usePathname();
  const [active, setActive] = useState<{ kind: string; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setActive(d.active))
      .catch(() => {});
  }, [path]); // refresh after visiting settings
  return (
    <aside
      style={{
        width: 224, flexShrink: 0,
        borderRight: "1px solid var(--hairline)",
        padding: "24px 14px",
        position: "sticky", top: 0, height: "100vh",
        background: "var(--bg-2)",
        display: "flex", flexDirection: "column",
      }}
    >
      <Link href="/" style={{ textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 34, padding: "0 8px" }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid var(--hairline-strong)", background: "var(--surface)",
              display: "grid", placeItems: "center", color: "var(--accent)",
            }}
          >
            <Icon.target size={17} />
          </div>
          <div className="display" style={{ fontSize: 17, color: "var(--text)" }}>ReviewIQ</div>
        </div>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          const I = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "9px 11px", borderRadius: 9, fontSize: 13.5, fontWeight: 550,
                textDecoration: "none",
                color: active ? "var(--text)" : "var(--muted)",
                background: active ? "var(--surface)" : "transparent",
                border: active ? "1px solid var(--hairline)" : "1px solid transparent",
                transition: "color .14s, background .14s",
              }}
            >
              <I size={16} style={{ color: active ? "var(--accent)" : "var(--muted)" }} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto" }}>
        <Link href="/settings" style={{ textDecoration: "none" }}>
          <div className="card" style={{ padding: "12px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pos)", flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.02em" }}>
                {active ? PROVIDER_LABEL[active.kind] || active.kind : "…"}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              {active?.kind === "claude-cli"
                ? "AI runs on your Claude subscription. No API key."
                : active?.model
                ? `Model: ${active.model}`
                : "Bring your own key · click to configure."}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}
