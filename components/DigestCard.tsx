"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

type Channel = "none" | "webhook" | "email";

interface View {
  enabled: boolean;
  channel: Channel;
  onlyWhenChanged: boolean;
  hasWebhookUrl: boolean;
  hasEmailKey: boolean;
  emailFrom: string;
  emailTo: string;
}

export default function DigestCard() {
  const [v, setV] = useState<View | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(""); // blank = keep stored
  const [emailApiKey, setEmailApiKey] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  function load() {
    fetch("/api/digest")
      .then((r) => r.json())
      .then((d: View) => {
        setV(d);
        setEmailFrom(d.emailFrom || "");
        setEmailTo(d.emailTo || "");
      })
      .catch(() => {});
  }
  useEffect(() => { load(); }, []);

  function body(extra: Record<string, unknown> = {}) {
    if (!v) return extra;
    return {
      enabled: v.enabled,
      channel: v.channel,
      onlyWhenChanged: v.onlyWhenChanged,
      // Send secrets only when typed; omitted = keep.
      webhookUrl: webhookUrl.length ? webhookUrl : undefined,
      emailApiKey: emailApiKey.length ? emailApiKey : undefined,
      emailFrom,
      emailTo,
      ...extra,
    };
  }

  async function save() {
    setBusy(true); setNote("");
    const d = await fetch("/api/digest", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body()),
    }).then((r) => r.json());
    setBusy(false);
    if (d.error) { setNote(d.error); return; }
    setWebhookUrl(""); setEmailApiKey("");
    setNote("Saved. Digests send after each scheduled scan.");
    load();
  }

  async function test() {
    setBusy(true); setNote("Saving & sending test digest…");
    const d = await fetch("/api/digest", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body({ action: "test" })),
    }).then((r) => r.json());
    setBusy(false);
    // Config was persisted (save-then-test); clear typed secrets like save does.
    setWebhookUrl(""); setEmailApiKey("");
    if (d.ok && d.skipped) setNote("Saved. Nothing changed since the last check — nothing sent (turn off “only when changed” to force).");
    else if (d.ok) setNote(`Saved. Sent a digest for ${d.sent} project(s) via ${d.channel}.`);
    else setNote(`Saved, but delivery failed: ${d.error || "unknown error"}`);
    load();
  }

  if (!v) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Digest delivery</div>
        <div className="muted" style={{ fontSize: 13 }}><Spinner /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
      </div>
    );
  }

  const set = (patch: Partial<View>) => { setV({ ...v, ...patch }); setNote(""); };

  return (
    <div className="card" style={{ padding: 24, marginTop: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Digest delivery</div>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
        After each scheduled scan, send a “what changed since last time” digest (rating/review moves, rising complaints
        &amp; praises) to a webhook or email. Pairs with <strong style={{ color: "var(--text-dim)" }}>Automatic re-scrape</strong> above.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={v.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span style={{ fontSize: 13.5 }}>Send digests<span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{v.enabled ? "on" : "off"}</span></span>
      </label>

      <div style={{ marginBottom: 16 }}>
        <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Channel</label>
        <select className="input" value={v.channel} onChange={(e) => set({ channel: e.target.value as Channel })}>
          <option value="none">None</option>
          <option value="webhook">Webhook (Slack / Discord / generic)</option>
          <option value="email">Email (Resend)</option>
        </select>
      </div>

      {v.channel === "webhook" && (
        <div style={{ marginBottom: 16 }}>
          <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Webhook URL</label>
          <input
            className="input mono" type="password" style={{ fontSize: 12 }}
            placeholder={v.hasWebhookUrl ? "•••••• (leave blank to keep)" : "https://hooks.slack.com/…"}
            value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>
      )}

      {v.channel === "email" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>From</label>
              <input className="input mono" style={{ fontSize: 12 }} placeholder="digest@yourdomain.com" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} />
            </div>
            <div>
              <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>To</label>
              <input className="input mono" style={{ fontSize: 12 }} placeholder="you@example.com" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>Resend API key</label>
            <input
              className="input mono" type="password" style={{ fontSize: 12 }}
              placeholder={v.hasEmailKey ? "•••••• (leave blank to keep)" : "re_…"}
              value={emailApiKey} onChange={(e) => setEmailApiKey(e.target.value)}
            />
          </div>
        </>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, cursor: "pointer" }}>
        <input type="checkbox" checked={v.onlyWhenChanged} onChange={(e) => set({ onlyWhenChanged: e.target.checked })} />
        <span style={{ fontSize: 13 }}>Only send when something changed</span>
      </label>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? <Spinner /> : <Icon.check size={15} />}<span style={{ marginLeft: 6 }}>Save</span>
        </button>
        <button className="btn" onClick={test} disabled={busy || v.channel === "none"}>
          {busy ? <Spinner /> : <Icon.spark size={15} />}<span style={{ marginLeft: 6 }}>Send test digest</span>
        </button>
        {note && <span className="muted" style={{ fontSize: 12.5 }}>{note}</span>}
      </div>
    </div>
  );
}
