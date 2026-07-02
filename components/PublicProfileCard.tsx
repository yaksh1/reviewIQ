"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";

interface PublicProfile {
  enabled: boolean;
  name: string;
  tagline: string;
  goal: string;
  profit: string;
  startDate: string;
  youtube: string;
  twitter: string;
  website: string;
}

const EMPTY: PublicProfile = {
  enabled: false,
  name: "",
  tagline: "",
  goal: "",
  profit: "",
  startDate: "",
  youtube: "",
  twitter: "",
  website: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>{label}</label>
      <input
        className={`input${mono ? " mono" : ""}`}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function PublicProfileCard() {
  const [p, setP] = useState<PublicProfile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/public/profile")
      .then((r) => r.json())
      .then((d: PublicProfile) => { setP({ ...EMPTY, ...d }); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  function set<K extends keyof PublicProfile>(k: K, v: PublicProfile[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
    setNote("");
  }

  async function save() {
    setSaving(true);
    setNote("");
    try {
      const res = await fetch("/api/public/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setP({ ...EMPTY, ...d.profile });
      setNote("Saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/p`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card" style={{ padding: 24, marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
        <div className="eyebrow">Public profile</div>
        <a href="/p" target="_blank" rel="noreferrer" className="btn btn-sm">
          <Icon.external size={14} /> <span style={{ marginLeft: 6 }}>View page</span>
        </a>
      </div>

      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, marginTop: 0, marginBottom: 18 }}>
        A shareable “build in public” page at <span className="mono">/p</span> showing live stats and your apps.
        Mine-only — competitor data is never shown. Toggle it on to publish.
      </p>

      {!loaded ? (
        <div className="muted" style={{ fontSize: 13 }}><Spinner /> <span style={{ marginLeft: 8 }}>Loading…</span></div>
      ) : (
        <>
          {/* Enable toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={p.enabled} onChange={(e) => set("enabled", e.target.checked)} />
            <span style={{ fontSize: 13.5 }}>
              Publish the public page
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                {p.enabled ? "live at /p" : "currently hidden"}
              </span>
            </span>
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Field label="Your name / handle" value={p.name} onChange={(v) => set("name", v)} placeholder="e.g. Diego" />
            <Field label="Goal" value={p.goal} onChange={(v) => set("goal", v)} placeholder="e.g. $100k USD" />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Field label="Tagline (hero headline)" value={p.tagline} onChange={(v) => set("tagline", v)} placeholder="Coding my way to $100k" />
          </div>

          <div style={{ marginBottom: 16, maxWidth: "calc(50% - 8px)" }}>
            <Field label="Profit (header banner)" value={p.profit} onChange={(v) => set("profit", v)} placeholder="e.g. $0" mono />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Field label="Start date (for “Day N”)" value={p.startDate} onChange={(v) => set("startDate", v)} placeholder="2026-05-01" type="date" mono />
            <Field label="Website" value={p.website} onChange={(v) => set("website", v)} placeholder="https://…" mono />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <Field label="YouTube" value={p.youtube} onChange={(v) => set("youtube", v)} placeholder="https://youtube.com/@…" mono />
            <Field label="X / Twitter" value={p.twitter} onChange={(v) => set("twitter", v)} placeholder="https://x.com/…" mono />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? <Spinner /> : <Icon.check size={15} />}
              <span style={{ marginLeft: 6 }}>Save</span>
            </button>
            <button className="btn" onClick={copyLink}>
              {copied ? <Icon.check size={15} /> : <Icon.copy size={15} />}
              <span style={{ marginLeft: 6 }}>{copied ? "Copied!" : "Copy public link"}</span>
            </button>
            {note && <span className="muted" style={{ fontSize: 12.5 }}>{note}</span>}
          </div>
        </>
      )}
    </div>
  );
}
