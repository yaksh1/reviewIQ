"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

interface GaApp {
  ext_id: string;
  name: string;
  property_id: string;
  last_sync: string | null;
  active_users: number | null;
}
interface GaConfig {
  hasKey: boolean;
  clientEmail: string;
  properties: Record<string, string>;
  apps: GaApp[];
}

export default function MetricsCard() {
  const [ga, setGa] = useState<GaConfig | null>(null);
  const [saJson, setSaJson] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function loadGa() {
    fetch("/api/ga").then((r) => r.json()).then(setGa).catch(() => {});
  }
  useEffect(() => { loadGa(); }, []);

  async function gaPost(payload: Record<string, unknown>) {
    const r = await fetch("/api/ga", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  }

  async function uploadKey() {
    if (!saJson.trim()) { setNote("Paste or choose your service-account JSON first."); return; }
    setBusy(true); setNote("");
    const d = await gaPost({ action: "saveKey", saJson });
    setBusy(false);
    if (d.error) { setNote(d.error); return; }
    setSaJson("");
    setNote("Service account saved.");
    loadGa();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setSaJson(String(reader.result || ""));
    reader.readAsText(f);
  }

  async function clearKey() {
    setBusy(true);
    await gaPost({ action: "clearKey" });
    setBusy(false);
    setNote("Service account removed.");
    loadGa();
  }

  async function saveProperty(extId: string, propertyId: string) {
    await gaPost({ action: "setProperty", extId, propertyId });
    loadGa();
  }

  async function testProp(extId: string) {
    setNote("Testing…");
    const d = await gaPost({ action: "test", extId });
    setNote(d.ok ? `OK — ${d.activeUsers ?? 0} active users (7d).` : `Failed: ${d.error}`);
  }

  async function sync(extId?: string) {
    setBusy(true); setNote("Syncing Google Analytics…");
    const d = await gaPost({ action: "sync", extId });
    setBusy(false);
    const ok = (d.results || []).filter((r: { ok: boolean }) => r.ok).length;
    const fail = (d.results || []).filter((r: { ok: boolean }) => !r.ok);
    setNote(`Synced ${ok} app(s).` + (fail.length ? ` ${fail.length} failed: ${fail[0].error}` : ""));
    loadGa();
  }

  return (
    <div className="card" style={{ padding: 24, marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Google Analytics</div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0, marginBottom: 20 }}>
        Pulls your apps’ traffic (active users, page views, sessions, geo) from the GA4 Data API and adds it to the
        public page. Uses a service-account key — works headless, no login.
      </p>

      {!ga ? (
        <div className="muted" style={{ fontSize: 13 }}><Spinner /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
      ) : !ga.hasKey ? (
        <>
          <div className="card-quiet" style={{ padding: "10px 13px", marginBottom: 12 }}>
            <span className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
              In Google Cloud, create a <strong>service account</strong>, download its <strong>JSON key</strong>, then in GA4 →
              Admin → Property Access add that service account’s email as a <strong>Viewer</strong>. Upload the key here.
            </span>
          </div>
          <textarea
            className="input mono"
            style={{ minHeight: 90, resize: "vertical", fontSize: 11.5 }}
            placeholder='Paste service-account JSON, or choose the file →'
            value={saJson}
            onChange={(e) => setSaJson(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon.doc size={14} /> <span style={{ marginLeft: 6 }}>Choose JSON file</span>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} />
            <button className="btn btn-primary btn-sm" onClick={uploadKey} disabled={busy}>
              {busy ? <Spinner size={12} /> : <Icon.key size={14} />}
              <span style={{ marginLeft: 6 }}>Save service account</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}>
              {ga.clientEmail || "service account connected"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" onClick={() => sync()} disabled={busy}>
                {busy ? <Spinner size={12} /> : <Icon.refresh size={14} />}
                <span style={{ marginLeft: 6 }}>Sync all</span>
              </button>
              <button className="btn btn-sm btn-danger" onClick={clearKey} disabled={busy}>
                <Icon.trash size={14} /> <span style={{ marginLeft: 6 }}>Remove key</span>
              </button>
            </div>
          </div>

          {ga.apps.length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5 }}>Add a “mine” extension to map a GA property.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ga.apps.map((a) => (
                <div key={a.ext_id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, minWidth: 150, color: "var(--text)" }}>{a.name}</span>
                  <input
                    className="input mono"
                    style={{ width: 150, fontSize: 12 }}
                    placeholder="GA4 property id"
                    defaultValue={a.property_id}
                    onBlur={(e) => { if (e.target.value !== a.property_id) saveProperty(a.ext_id, e.target.value); }}
                  />
                  <button className="btn btn-sm" onClick={() => testProp(a.ext_id)}>Test</button>
                  <span className="muted mono" style={{ fontSize: 11 }}>
                    {a.last_sync ? `synced ${new Date(a.last_sync).toLocaleDateString()}` : "not synced"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {note && <div className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>{note}</div>}
    </div>
  );
}
