"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExtWithCount } from "./page";

interface DirectoryKit {
  core: Record<string, string>;
  taglines: { short: string; medium: string; long: string };
  descriptions: { one_liner: string; short: string; medium: string; long: string };
  feature_list: string[];
  pricing_table: { plan: string; price: string; notes: string }[];
  social_proof: string[];
  keywords: string[];
  problem_solution_pairs: { problem: string; solution: string }[];
  about_boilerplate: string;
}
interface KitResult {
  kit: DirectoryKit;
  website: string;
  generated_at?: string;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn btn-sm"
      style={{ display: "inline-flex", gap: 5, color: done ? "var(--pos)" : undefined }}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <><Icon.check size={13} /> Copied</> : <><Icon.copy size={13} /> {label}</>}
    </button>
  );
}

function Block({ title, copyText, children }: { title: string; copyText: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: 0 }}>{title}</h3>
        <CopyButton text={copyText} />
      </div>
      {children}
    </div>
  );
}

const CORE_LABELS: Record<string, string> = {
  product_name: "Product Name",
  website: "Website",
  chrome_web_store_url: "Chrome Web Store",
  category: "Category",
  pricing_model: "Pricing Model",
  platform: "Platform",
  works_with: "Works With",
};

function kitToMarkdown(k: DirectoryKit): string {
  const core = Object.entries(k.core).map(([key, v]) => `**${CORE_LABELS[key] || key}:** ${v}`).join("\n");
  return `# ${k.core.product_name || "Directory Kit"}

## Core Identity
${core}

## Taglines
- Short (<60): ${k.taglines.short}
- Medium (<100): ${k.taglines.medium}
- Long (<160): ${k.taglines.long}

## Descriptions
**One-liner:** ${k.descriptions.one_liner}

**Short (50-80w):** ${k.descriptions.short}

**Medium (100-150w):** ${k.descriptions.medium}

**Long (300w+):** ${k.descriptions.long}

## Feature List
${k.feature_list.map((f) => `- ${f}`).join("\n")}

## Pricing Table
| Plan | Price | Notes |
|---|---|---|
${k.pricing_table.map((p) => `| ${p.plan} | ${p.price} | ${p.notes} |`).join("\n")}

## Social Proof & Stats
${k.social_proof.map((s) => `- ${s}`).join("\n")}

## Keywords / Tags
${k.keywords.join(", ")}

## Problem / Solution Pairs
${k.problem_solution_pairs.map((p) => `**Problem:** ${p.problem}\n**Solution:** ${p.solution}`).join("\n\n")}

## About Boilerplate
${k.about_boilerplate}`;
}

const cell: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid var(--hairline)", fontSize: 13 };

export default function DirectoryKitTab({ mine }: { mine?: ExtWithCount }) {
  const [data, setData] = useState<KitResult | null>(null);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null); setWebsite("");
    if (!mine) return;
    if (mine.website) setWebsite(mine.website);
    fetch(`/api/extensions/${mine.id}/directory-kit`).then((r) => r.json()).then((d) => {
      if (d) { setData(d); if (d.website) setWebsite(d.website); }
    });
  }, [mine]);

  async function generate() {
    if (!mine) return;
    setLoading(true); setErr("");
    const r = await fetch(`/api/extensions/${mine.id}/directory-kit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ website }),
    });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    else setData(await r.json());
    setLoading(false);
  }

  if (!mine)
    return <Empty icon="target" title="No “Mine” extension assigned">Mark one extension as “Mine” in the Extensions tab to generate a directory submission kit.</Empty>;

  const k = data?.kit;

  return (
    <div className="fade-in">
      <p className="muted" style={{ fontSize: 13.5, margin: "0 0 14px", maxWidth: 620 }}>
        Generate a complete <strong style={{ color: "var(--text)" }}>directory submission playbook</strong> (Product Hunt, BetaList, SaaSHub, AlternativeTo…) — copy-paste-ready blocks grounded in your website + Chrome Web Store listing.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 280 }}
            placeholder="Product website URL (e.g. kortex-notebooklm.com) — optional but recommended"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate()}
          />
          {k && <CopyButton text={kitToMarkdown(k)} label="Copy full doc" />}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? <><Spinner /> {website ? "Scraping site & generating…" : "Generating…"}</> : k ? "Regenerate" : "Generate kit"}
          </button>
        </div>
        {data?.website && <div className="muted" style={{ fontSize: 12, marginTop: 9, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pos)" }} />Grounded in {data.website} + Chrome Web Store listing</div>}
        {err && <div style={{ color: "var(--neg)", fontSize: 13, marginTop: 8 }}>{err}</div>}
      </div>

      {!k && !loading && <Empty icon="spark" title="No kit yet">Add your website URL (optional) and click “Generate kit”.</Empty>}

      {k && (
        <div style={{ display: "grid", gap: 14 }}>
          <Block title="Core Identity" copyText={Object.entries(k.core).map(([key, v]) => `${CORE_LABELS[key] || key}: ${v}`).join("\n")}>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.entries(k.core).map(([key, v]) => (
                <div key={key} style={{ display: "flex", gap: 10, fontSize: 13.5 }}>
                  <span className="muted" style={{ minWidth: 140, fontWeight: 600 }}>{CORE_LABELS[key] || key}</span>
                  <span style={{ color: "var(--text-dim)", wordBreak: "break-word" }}>{v}</span>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Taglines" copyText={`Short: ${k.taglines.short}\nMedium: ${k.taglines.medium}\nLong: ${k.taglines.long}`}>
            {(["short", "medium", "long"] as const).map((key) => {
              const limit = key === "short" ? 60 : key === "medium" ? 100 : 160;
              const val = k.taglines[key];
              const over = val.length > limit;
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                    <span className="muted" style={{ textTransform: "uppercase", fontWeight: 700 }}>{key} (&lt;{limit})</span>
                    <span style={{ color: over ? "var(--neg)" : "var(--pos)" }}>{val.length}/{limit}</span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text-dim)" }}>{val}</div>
                </div>
              );
            })}
          </Block>

          {([
            ["One-liner", k.descriptions.one_liner],
            ["Short description (50–80w)", k.descriptions.short],
            ["Medium description (100–150w)", k.descriptions.medium],
            ["Long description (300w+)", k.descriptions.long],
          ] as const).map(([title, txt]) => (
            <Block key={title} title={title} copyText={txt}>
              <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{txt}</div>
            </Block>
          ))}

          <Block title="Feature List" copyText={k.feature_list.map((f) => `- ${f}`).join("\n")}>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13.5, color: "var(--text-dim)" }}>
              {k.feature_list.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </Block>

          <Block title="Pricing Table" copyText={k.pricing_table.map((p) => `${p.plan} | ${p.price} | ${p.notes}`).join("\n")}>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto 1fr", border: "1px solid var(--hairline)", borderRadius: 8, overflow: "hidden" }}>
              {["Plan", "Price", "Notes"].map((h) => <div key={h} style={{ ...cell, fontWeight: 700, background: "var(--surface-2)" }}>{h}</div>)}
              {k.pricing_table.map((p, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div style={cell}>{p.plan}</div>
                  <div style={cell}>{p.price}</div>
                  <div style={cell}>{p.notes}</div>
                </div>
              ))}
            </div>
          </Block>

          <Block title="Social Proof & Stats" copyText={k.social_proof.map((s) => `- ${s}`).join("\n")}>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13.5, color: "var(--text-dim)" }}>
              {k.social_proof.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Block>

          <Block title="Keywords / Tags" copyText={k.keywords.join(", ")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {k.keywords.map((kw, i) => (
                <span key={i} style={{ fontSize: 12.5, padding: "3px 9px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--hairline)", color: "var(--text-dim)" }}>{kw}</span>
              ))}
            </div>
          </Block>

          <Block title="Problem / Solution Pairs" copyText={k.problem_solution_pairs.map((p) => `Problem: ${p.problem}\nSolution: ${p.solution}`).join("\n\n")}>
            <div style={{ display: "grid", gap: 12 }}>
              {k.problem_solution_pairs.map((p, i) => (
                <div key={i}>
                  <div style={{ fontSize: 13.5 }}><span style={{ color: "var(--neg)", fontWeight: 700 }}>Problem · </span><span style={{ color: "var(--text-dim)" }}>{p.problem}</span></div>
                  <div style={{ fontSize: 13.5 }}><span style={{ color: "var(--pos)", fontWeight: 700 }}>Solution · </span><span style={{ color: "var(--text-dim)" }}>{p.solution}</span></div>
                </div>
              ))}
            </div>
          </Block>

          <Block title="About Boilerplate" copyText={k.about_boilerplate}>
            <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>{k.about_boilerplate}</div>
          </Block>
        </div>
      )}
    </div>
  );
}
