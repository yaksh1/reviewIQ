"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

interface Status {
  enabled: boolean;
  intervalHours: number;
  running: boolean;
  lastRun: string | null;
  nextRun: string | null;
  lastResult: { projects: number; ok: number; failed: number } | null;
  lastError: string | null;
}

const PRESETS = [
  { label: "Every 6 hours", hours: 6 },
  { label: "Every 12 hours", hours: 12 },
  { label: "Daily", hours: 24 },
  { label: "Every 3 days", hours: 72 },
  { label: "Weekly", hours: 168 },
];

function rel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function ScheduleCard() {
  const [s, setS] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  function load() {
    fetch("/api/schedule").then((r) => r.json()).then(setS).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  async function save(patch: Partial<Pick<Status, "enabled" | "intervalHours">>) {
    setSaving(true);
    setNote("");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (d.status) setS(d.status);
      setNote("Saved.");
    } catch {
      setNote("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setNote("Started a re-scrape…");
    await fetch("/api/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "runNow" }),
    });
    // Poll status a few times so the user sees it flip to running / finish.
    let n = 0;
    const t = setInterval(() => {
      load();
      if (++n >= 6) clearInterval(t);
    }, 2000);
  }

  return (
    <div className="card" style={{ padding: 24, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
        <div className="eyebrow">Automatic re-scrape</div>
        {s?.running && (
          <span className="mono" style={{ fontSize: 11.5, color: "var(--accent-100)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Spinner size={12} /> running…
          </span>
        )}
      </div>

      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
        Re-scrapes every project on a schedule and records a dated snapshot each time. This is what makes
        Trends and the public live-stats deltas move over time.
      </p>

      {!s ? (
        <div className="muted" style={{ fontSize: 13 }}><Spinner /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={s.enabled} disabled={saving} onChange={(e) => save({ enabled: e.target.checked })} />
            <span style={{ fontSize: 13.5 }}>
              Enable scheduled re-scrape
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{s.enabled ? "on" : "off"}</span>
            </span>
          </label>

          <div style={{ marginBottom: 18 }}>
            <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Interval</label>
            <select
              className="input"
              value={s.intervalHours}
              disabled={saving}
              onChange={(e) => save({ intervalHours: Number(e.target.value) })}
            >
              {PRESETS.map((p) => (
                <option key={p.hours} value={p.hours}>{p.label}</option>
              ))}
              {!PRESETS.some((p) => p.hours === s.intervalHours) && (
                <option value={s.intervalHours}>Every {s.intervalHours}h</option>
              )}
            </select>
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
            <div>
              <div className="eyebrow">Last run</div>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{rel(s.lastRun)}</div>
            </div>
            <div>
              <div className="eyebrow">Next run</div>
              <div className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{s.enabled ? rel(s.nextRun) : "—"}</div>
            </div>
            {s.lastResult && (
              <div>
                <div className="eyebrow">Last result</div>
                <div className="mono" style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                  {s.lastResult.projects} projects · {s.lastResult.ok} ok
                  {s.lastResult.failed ? ` · ${s.lastResult.failed} failed` : ""}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" onClick={runNow} disabled={s.running}>
              <Icon.refresh size={15} /> <span style={{ marginLeft: 6 }}>Run now</span>
            </button>
            {note && <span className="muted" style={{ fontSize: 12.5 }}>{note}</span>}
          </div>

          {s.lastError && (
            <div style={{ fontSize: 12.5, marginTop: 12, color: "var(--neg)", lineHeight: 1.5, wordBreak: "break-word" }}>
              Last error: {s.lastError}
            </div>
          )}
        </>
      )}
    </div>
  );
}
