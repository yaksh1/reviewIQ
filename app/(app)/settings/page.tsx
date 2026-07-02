"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import PublicProfileCard from "@/components/PublicProfileCard";
import ScheduleCard from "@/components/ScheduleCard";
import MetricsCard from "@/components/MetricsCard";
import ExtMetaCard from "@/components/ExtMetaCard";

type ProviderKind = "claude-cli" | "anthropic" | "openai-compatible";

interface Preset {
  id: string;
  label: string;
  kind: ProviderKind;
  baseURL?: string;
  defaultModel?: string;
  models?: string[];
  keyHint?: string;
  needsKey: boolean;
}

interface SettingsResponse {
  presets: Preset[];
  settings: { kind: ProviderKind; hasKey: boolean; keyMasked: string; baseURL: string; model: string } | null;
  active: { kind: ProviderKind; model: string; baseURL: string };
  env: { anthropic: boolean; openai: boolean };
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [presetId, setPresetId] = useState<string>("claude-cli");
  const [apiKey, setApiKey] = useState<string>(""); // empty = keep stored key
  const [baseURL, setBaseURL] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyMasked, setKeyMasked] = useState("");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedNote, setSavedNote] = useState<string>("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const preset = useMemo(
    () => data?.presets.find((p) => p.id === presetId),
    [data, presetId]
  );

  // Initial load — hydrate form from saved settings (or sensible default).
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsResponse) => {
        setData(d);
        const s = d.settings;
        if (s) {
          // Match the saved config back to a preset where possible.
          const match = d.presets.find(
            (p) =>
              p.kind === s.kind &&
              (p.kind !== "openai-compatible" || (p.baseURL || "") === (s.baseURL || ""))
          );
          setPresetId(match?.id || (s.kind === "openai-compatible" ? "custom" : s.kind));
          setBaseURL(s.baseURL || "");
          setModel(s.model || "");
          setHasStoredKey(s.hasKey);
          setKeyMasked(s.keyMasked);
        }
      })
      .catch(() => {});
  }, []);

  function onPickPreset(id: string) {
    setPresetId(id);
    setTestResult(null);
    setSavedNote("");
    const p = data?.presets.find((x) => x.id === id);
    if (!p) return;
    setBaseURL(p.baseURL || "");
    setModel(p.defaultModel || "");
    // Switching providers means the stored key (if any) belongs to the old one.
    setApiKey("");
    setHasStoredKey(false);
    setKeyMasked("");
  }

  function buildBody(action: "save" | "test") {
    return {
      action,
      kind: preset?.kind,
      // Send apiKey only when the user typed one; undefined keeps the stored key.
      apiKey: apiKey.length ? apiKey : undefined,
      baseURL: preset?.kind === "openai-compatible" ? baseURL : undefined,
      model: model || undefined,
    };
  }

  async function save() {
    setSaving(true);
    setSavedNote("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBody("save")),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      setApiKey("");
      if (d.settings) {
        setHasStoredKey(d.settings.hasKey);
        setKeyMasked(d.settings.keyMasked);
      }
      setSavedNote("Saved. New analyses will use this provider.");
      // Refresh the "currently active" view to reflect the new resolution.
      fetch("/api/settings")
        .then((r) => r.json())
        .then((fresh: SettingsResponse) => setData((d) => (d ? { ...d, active: fresh.active } : fresh)))
        .catch(() => {});
    } catch (e) {
      setSavedNote(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildBody("test")),
      });
      const d = await res.json();
      setTestResult(
        d.ok
          ? { ok: true, msg: `Connected. Replied: ${JSON.stringify(d.sample)}` }
          : { ok: false, msg: d.error || "Test failed" }
      );
    } catch (e) {
      setTestResult({ ok: false, msg: e instanceof Error ? e.message : "Test failed" });
    } finally {
      setTesting(false);
    }
  }

  if (!data) {
    return (
      <div style={{ padding: "40px 0", color: "var(--muted)" }}>
        <Spinner /> <span style={{ marginLeft: 8 }}>Loading settings…</span>
      </div>
    );
  }

  const needsKey = preset?.needsKey ?? false;
  const isCustom = presetId === "custom";

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHeader
        title="Settings"
        subtitle="Choose how AI analysis runs. Self-host with your local Claude subscription (no key), or bring your own API key for any provider. Keys are encrypted at rest and never leave this server."
      />

      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>AI Provider</div>

        {/* Provider picker */}
        <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
          Provider
        </label>
        <select
          className="input"
          value={presetId}
          onChange={(e) => onPickPreset(e.target.value)}
          style={{ marginBottom: 18 }}
        >
          {data.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Hint */}
        {preset?.keyHint && (
          <div
            className="card-quiet"
            style={{ padding: "10px 13px", marginBottom: 18, display: "flex", gap: 9, alignItems: "flex-start" }}
          >
            <Icon.key size={15} style={{ color: "var(--muted)", marginTop: 2, flexShrink: 0 }} />
            <span className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{preset.keyHint}</span>
          </div>
        )}

        {/* Base URL — only for custom OpenAI-compatible endpoints */}
        {isCustom && (
          <div style={{ marginBottom: 18 }}>
            <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
              Base URL
            </label>
            <input
              className="input mono"
              placeholder="https://your-endpoint/v1"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
            />
          </div>
        )}

        {/* API key */}
        {needsKey && (
          <div style={{ marginBottom: 18 }}>
            <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
              API key
            </label>
            <input
              className="input mono"
              type="password"
              placeholder={hasStoredKey ? `${keyMasked} (leave blank to keep)` : "Paste your API key"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            {hasStoredKey && (
              <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                A key is saved. Leave blank to keep it, type a new one to replace, or clear it below.
              </div>
            )}
          </div>
        )}

        {/* Model */}
        <div style={{ marginBottom: 18 }}>
          <label className="muted" style={{ fontSize: 12.5, display: "block", marginBottom: 6 }}>
            Model {preset?.kind === "claude-cli" && <span style={{ opacity: 0.6 }}>(uses your CLI default)</span>}
          </label>
          {preset?.models?.length ? (
            <input
              className="input mono"
              list="model-suggestions"
              placeholder={preset.defaultModel || "model id"}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={preset.kind === "claude-cli"}
            />
          ) : (
            <input
              className="input mono"
              placeholder={preset?.defaultModel || "model id"}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={preset?.kind === "claude-cli"}
            />
          )}
          {preset?.models?.length ? (
            <datalist id="model-suggestions">
              {preset.models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          ) : null}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <Spinner /> : <Icon.check size={15} />}
            <span style={{ marginLeft: 6 }}>Save</span>
          </button>
          <button className="btn" onClick={test} disabled={testing}>
            {testing ? <Spinner /> : <Icon.spark size={15} />}
            <span style={{ marginLeft: 6 }}>Test connection</span>
          </button>
          {needsKey && hasStoredKey && (
            <button
              className="btn btn-danger"
              onClick={async () => {
                await fetch("/api/settings", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "save",
                    kind: preset?.kind,
                    apiKey: "",
                    baseURL: preset?.kind === "openai-compatible" ? baseURL : undefined,
                    model: model || undefined,
                  }),
                });
                setHasStoredKey(false);
                setKeyMasked("");
                setApiKey("");
                setSavedNote("Key cleared.");
              }}
            >
              <Icon.trash size={15} />
              <span style={{ marginLeft: 6 }}>Clear key</span>
            </button>
          )}
        </div>

        {savedNote && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>{savedNote}</div>
        )}
        {testResult && (
          <div
            style={{
              fontSize: 12.5,
              marginTop: 14,
              color: testResult.ok ? "var(--pos)" : "var(--neg)",
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {testResult.msg}
          </div>
        )}
      </div>

      {/* Resolution chain explainer */}
      <div className="card-quiet" style={{ padding: "16px 18px", marginTop: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>How the provider is chosen</div>
        <ol className="muted" style={{ fontSize: 12.5, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>The provider saved on this page (above).</li>
          <li>
            Else an environment key:{" "}
            <span className="mono">ANTHROPIC_API_KEY</span>
            {data.env.anthropic ? " (set)" : ""} or{" "}
            <span className="mono">OPENAI_API_KEY</span>
            {data.env.openai ? " (set)" : ""}.
          </li>
          <li>
            Else local <span className="mono">claude -p</span> (your Claude subscription on this machine).
          </li>
        </ol>
        <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
          Currently active: <span className="mono" style={{ color: "var(--text-dim)" }}>{data.active.kind}</span>
          {data.active.model ? <span className="mono"> · {data.active.model}</span> : null}
        </div>
      </div>

      {/* Automatic re-scrape scheduler */}
      <ScheduleCard />

      {/* Private metrics: Google Analytics + manual Web Store numbers */}
      <MetricsCard />

      {/* Public "build in public" profile */}
      <PublicProfileCard />

      {/* Per-app public badges */}
      <ExtMetaCard />
    </div>
  );
}
