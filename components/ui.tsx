"use client";
import React from "react";
import { Icon } from "./icons";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 30, gap: 16, flexWrap: "wrap" }}>
      <div>
        <h1 className="display" style={{ fontSize: 32 }}>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: "9px 0 0", fontSize: 14, maxWidth: 620, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block", width: size, height: size,
        border: "1.5px solid rgba(255,255,255,.25)", borderTopColor: "currentColor",
        borderRadius: "50%", flexShrink: 0,
      }}
    />
  );
}

export function Stars({ n }: { n: number | null }) {
  const v = n ?? 0;
  return (
    <span style={{ display: "inline-flex", gap: 1.5, alignItems: "center" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon.star key={i} size={12} style={{ color: i < v ? "var(--warn)" : "var(--faint)" }} />
      ))}
    </span>
  );
}

export function Empty({ icon = "spark", title, children }: { icon?: keyof typeof Icon; title: string; children?: React.ReactNode }) {
  const I = Icon[icon];
  return (
    <div className="card-quiet" style={{ padding: "56px 24px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", padding: 14, borderRadius: 12, border: "1px solid var(--hairline)", color: "var(--muted)", marginBottom: 16 }}>
        <I size={22} />
      </div>
      <div className="display" style={{ fontSize: 19, marginBottom: 7 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13.5, maxWidth: 440, margin: "0 auto", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="tabbar">
      {tabs.map((t) => (
        <button key={t.key} className="tab" data-active={active === t.key} onClick={() => onChange(t.key)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
