"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

interface ExtMeta { builtIn: string; prompts: string; price: string; created: string }
interface App { ext_id: string; name: string; category: string; meta: ExtMeta }

const FIELDS: { key: keyof ExtMeta; label: string; placeholder: string }[] = [
  { key: "builtIn", label: "Built in", placeholder: "e.g. 3 days" },
  { key: "prompts", label: "Prompts", placeholder: "e.g. 142" },
  { key: "price", label: "Price", placeholder: "Free / $4/mo" },
  { key: "created", label: "Created", placeholder: "May 2026" },
];

export default function ExtMetaCard() {
  const [apps, setApps] = useState<App[] | null>(null);
  const [note, setNote] = useState("");

  function load() {
    fetch("/api/public/ext-meta").then((r) => r.json()).then((d) => setApps(d.apps || [])).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function save(app: App) {
    await fetch("/api/public/ext-meta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ extId: app.ext_id, ...app.meta }),
    });
    setNote(`Saved ${app.name}.`);
  }

  return (
    <div className="card" style={{ padding: 24, marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Per-app details (public badges)</div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
        Shown on each app’s public page header (<span className="mono">/p/&lt;id&gt;</span>). Category comes from the store automatically.
      </p>

      {!apps ? (
        <p className="muted" style={{ fontSize: 13 }}>Loading…</p>
      ) : apps.length === 0 ? (
        <p className="muted" style={{ fontSize: 12.5 }}>No “mine” extensions yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {apps.map((app, i) => (
            <div key={app.ext_id} className="card-quiet" style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 10 }}>{app.name}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="eyebrow" style={{ display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input
                      className="input mono"
                      style={{ width: 120, fontSize: 12 }}
                      placeholder={f.placeholder}
                      value={app.meta[f.key]}
                      onChange={(e) => setApps((prev) => prev!.map((x, j) => j === i ? { ...x, meta: { ...x.meta, [f.key]: e.target.value } } : x))}
                    />
                  </div>
                ))}
                <button className="btn btn-sm btn-primary" onClick={() => save(app)}>
                  <Icon.check size={14} /> <span style={{ marginLeft: 6 }}>Save</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {note && <div className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>{note}</div>}
    </div>
  );
}
