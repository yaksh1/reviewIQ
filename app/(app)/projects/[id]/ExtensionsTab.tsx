"use client";
import { useState } from "react";
import { Spinner, Stars, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExtWithCount } from "./page";

export default function ExtensionsTab({
  projectId,
  exts,
  reload,
  monthsBack,
}: {
  projectId: string;
  exts: ExtWithCount[];
  reload: () => Promise<void>;
  monthsBack: number;
}) {
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"mine" | "competitor">("competitor");
  const [adding, setAdding] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState("");
  const [months, setMonths] = useState(monthsBack);
  const [savingMonths, setSavingMonths] = useState(false);

  const mine = exts.find((e) => e.role === "mine");

  async function saveMonths(m: number) {
    const clamped = Math.max(1, Math.min(120, m));
    setMonths(clamped);
    setSavingMonths(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ months_back: clamped }),
    });
    setSavingMonths(false);
  }

  async function add() {
    if (!input.trim()) return;
    setErr(""); setAdding(true);
    const r = await fetch(`/api/projects/${projectId}/extensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, role }),
    });
    if (!r.ok) setErr((await r.json()).error || "Failed to add");
    else setInput("");
    setAdding(false);
    await reload();
  }

  async function setExtRole(extId: number, newRole: "mine" | "competitor") {
    // If promoting to mine, demote the current mine first.
    if (newRole === "mine" && mine && mine.id !== extId) {
      await fetch(`/api/extensions/${mine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "competitor" }),
      });
    }
    await fetch(`/api/extensions/${extId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    await reload();
  }

  async function remove(extId: number) {
    await fetch(`/api/extensions/${extId}`, { method: "DELETE" });
    await reload();
  }

  async function fetchAll() {
    setFetching(true); setErr(""); setProgress(`Scraping reviews from the last ${months} month${months > 1 ? "s" : ""}… this can take a minute.`);
    const r = await fetch(`/api/projects/${projectId}/fetch`, { method: "POST" });
    const data = await r.json();
    setProgress("");
    setFetching(false);
    if (data.results) {
      const failed = data.results.filter((x: any) => !x.ok);
      if (failed.length) setErr(`Some failed: ${failed.map((f: any) => f.ext_id).join(", ")}`);
    }
    await reload();
  }

  return (
    <div className="fade-in">
      {/* Add form */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Add an extension</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Chrome Web Store URL or extension ID (e.g. cjpalhdlnbpafiamejdnhcphjbkeiagm)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <div style={{ display: "flex", borderRadius: 9, overflow: "hidden", border: "1px solid var(--hairline-strong)" }}>
            {(["mine", "competitor"] as const).map((rk) => (
              <button
                key={rk}
                onClick={() => setRole(rk)}
                className="btn btn-sm"
                style={{
                  borderRadius: 0, border: "none",
                  background: role === rk ? "var(--accent)" : "var(--surface-2)",
                  color: role === rk ? "#fff" : "var(--muted)",
                }}
              >
                {rk === "mine" ? "Mine" : "Competitor"}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={add} disabled={adding || !input.trim()}>
            {adding ? <Spinner /> : "Add"}
          </button>
        </div>
        {err && <div style={{ color: "var(--neg)", fontSize: 13, marginTop: 10 }}>{err}</div>}
      </div>

      {/* Fetch bar */}
      {exts.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {progress || <>{exts.length} extension{exts.length > 1 ? "s" : ""} · <span className="mono">{exts.reduce((a, e) => a + e.review_count, 0)}</span> reviews fetched</>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Time window */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px 4px 12px", border: "1px solid var(--hairline-strong)", borderRadius: 9, background: "var(--surface-2)" }}>
              <span className="muted" style={{ fontSize: 12.5 }}>Reviews from the last</span>
              <input
                type="number"
                min={1}
                max={120}
                value={months}
                onChange={(e) => setMonths(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
                onBlur={() => saveMonths(months)}
                onKeyDown={(e) => e.key === "Enter" && saveMonths(months)}
                className="mono"
                style={{ width: 48, padding: "5px 6px", borderRadius: 7, background: "var(--bg)", border: "1px solid var(--hairline-strong)", color: "var(--text)", fontSize: 13, textAlign: "center", outline: "none" }}
              />
              <span className="muted" style={{ fontSize: 12.5 }}>month{months > 1 ? "s" : ""}</span>
              {savingMonths && <Spinner size={11} />}
            </div>
            <button className="btn btn-primary" onClick={fetchAll} disabled={fetching}>
              {fetching ? <><Spinner /> Fetching reviews…</> : <><Icon.refresh size={14} /> Fetch / refresh all</>}
            </button>
          </div>
        </div>
      )}

      {exts.length === 0 ? (
        <Empty icon="puzzle" title="No extensions yet">Add your extension (mark it “Mine”) and a few competitors to begin.</Empty>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {exts.map((e) => (
            <div key={e.id} className="card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
              {e.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.icon} alt="" width={42} height={42} style={{ borderRadius: 9, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 42, height: 42, borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--muted)" }}><Icon.puzzle size={18} /></div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{e.name || e.ext_id}</span>
                  <span className={`badge ${e.role === "mine" ? "badge-mine" : "badge-comp"}`}>{e.role}</span>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {e.rating != null && <span style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}><Stars n={Math.round(e.rating)} /> <span className="mono muted">{e.rating}</span></span>}
                  {e.rating_count != null && <span className="muted" style={{ fontSize: 12.5 }}><span className="mono">{e.rating_count.toLocaleString()}</span> ratings</span>}
                  {e.users && <span className="muted" style={{ fontSize: 12.5 }}><span className="mono">{e.users}</span> users</span>}
                  <span className="muted" style={{ fontSize: 12.5 }}><span className="mono">{e.review_count}</span> reviews fetched</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
                {e.role === "competitor" && (
                  <button className="btn btn-sm" onClick={() => setExtRole(e.id, "mine")}>Set as mine</button>
                )}
                <a className="btn btn-sm" href={`https://chromewebstore.google.com/detail/${e.ext_id}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 5 }}>Store <Icon.external size={12} /></a>
                <button className="btn btn-sm btn-danger" onClick={() => remove(e.id)} aria-label="Remove"><Icon.trash size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
