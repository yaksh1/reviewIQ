"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";
import { Icon } from "@/components/icons";
import type { ExtWithCount } from "./page";

function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block", marginRight: 7, verticalAlign: "middle" }} />;
}

interface PageIdea {
  page_query: string;
  keyword: string;
  slug: string;
  hook: string;
  recipe: {
    h1: string;
    intent_intro: string;
    how_it_works: string[];
    faq: { q: string; a: string }[];
    cta: string;
    where_it_fits: string;
  };
}
interface IdeasResult {
  ideas: PageIdea[];
  grounded: boolean;
  generated_at?: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="eyebrow" style={{ marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/** One-line "how to add" recipe summary shown inline under the angle. */
function recipeSummary(r: PageIdea["recipe"]): string {
  const faqHint = r.faq?.length ? `FAQ (${r.faq.map((f) => f.q).slice(0, 2).join("; ")})` : "FAQ";
  return `H1 matching query, intent intro, 3-step how-it-works (${r.how_it_works.join(", ")}), ${faqHint}, CTA — ${r.where_it_fits}.`;
}

const td: React.CSSProperties = {
  padding: "14px 16px",
  verticalAlign: "top",
  borderBottom: "1px solid var(--hairline)",
  fontSize: 13.5,
  lineHeight: 1.5,
};

function IdeaRow({ idea }: { idea: PageIdea }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer", background: open ? "var(--surface-2)" : "transparent" }}
      >
        {/* Page / Query */}
        <td style={{ ...td, minWidth: 220 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text)", marginBottom: 4 }}>{idea.page_query}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>“{idea.keyword}”</div>
        </td>
        {/* Keyword */}
        <td style={{ ...td, minWidth: 130 }}><span className="mono" style={{ color: "var(--accent)", fontSize: 12.5 }}>{idea.keyword}</span></td>
        {/* Angle & how to add */}
        <td style={{ ...td }}>
          <div style={{ color: "var(--text-dim)" }}>{idea.hook}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 7, display: "flex", gap: 7, alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent)", lineHeight: 1.4 }}>—</span>
            <span style={{ lineHeight: 1.5 }}>{recipeSummary(idea.recipe)}</span>
          </div>
        </td>
        {/* Slug */}
        <td style={{ ...td, minWidth: 150 }}>
          <span className="mono" style={{ fontSize: 12.5, color: "var(--muted)", wordBreak: "break-all" }}>/{idea.slug}/</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)", fontSize: 11.5, marginTop: 8 }}>
            <Icon.chevron size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .14s" }} /> {open ? "collapse" : "expand"}
          </span>
        </td>
      </tr>

      {open && (
        <tr className="fade-in">
          <td colSpan={4} style={{ padding: "6px 16px 20px 16px", borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              <div>
                <Field label="H1">{idea.recipe.h1}</Field>
                <Field label="Intent intro">{idea.recipe.intent_intro}</Field>
                <Field label="How it works">
                  <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                    {idea.recipe.how_it_works.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </Field>
              </div>
              <div>
                <Field label="FAQ">
                  <div style={{ display: "grid", gap: 8 }}>
                    {idea.recipe.faq.map((f, i) => (
                      <div key={i}>
                        <div style={{ fontWeight: 600 }}>{f.q}</div>
                        <div className="muted">{f.a}</div>
                      </div>
                    ))}
                  </div>
                </Field>
                <Field label="CTA"><span style={{ color: "var(--pos)", fontWeight: 600 }}>{idea.recipe.cta}</span></Field>
                <Field label="Where it fits">{idea.recipe.where_it_fits}</Field>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function PageIdeasTab({ mine }: { mine?: ExtWithCount }) {
  const [data, setData] = useState<IdeasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    if (!mine) return;
    fetch(`/api/extensions/${mine.id}/ideas`).then((r) => r.json()).then((d) => d && setData(d));
  }, [mine]);

  async function generate() {
    if (!mine) return;
    setLoading(true); setErr("");
    const r = await fetch(`/api/extensions/${mine.id}/ideas`, { method: "POST" });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    else setData(await r.json());
    setLoading(false);
  }

  function copyMarkdown() {
    if (!data) return;
    const md = data.ideas.map((it, i) =>
      `## ${i + 1}. ${it.page_query}\n` +
      `- **Keyword:** ${it.keyword} · **Slug:** /${it.slug}\n` +
      `- **Hook:** ${it.hook}\n` +
      `- **H1:** ${it.recipe.h1}\n` +
      `- **Intro:** ${it.recipe.intent_intro}\n` +
      `- **How it works:**\n${it.recipe.how_it_works.map((s) => `  1. ${s}`).join("\n")}\n` +
      `- **FAQ:**\n${it.recipe.faq.map((f) => `  - **${f.q}** ${f.a}`).join("\n")}\n` +
      `- **CTA:** ${it.recipe.cta}\n- **Where it fits:** ${it.recipe.where_it_fits}`
    ).join("\n\n");
    navigator.clipboard.writeText(md);
  }

  if (!mine)
    return <Empty icon="target" title="No “Mine” extension assigned">Mark one extension as “Mine” in the Extensions tab to generate page ideas for it.</Empty>;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 580 }}>
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            Fresh, SEO-ready landing/blog page ideas for <strong style={{ color: "var(--text)" }}>{mine.name || mine.ext_id}</strong>, grounded in real review demand.
          </p>
          {data && (
            <p style={{ fontSize: 12, margin: "8px 0 0", display: "flex", alignItems: "center" }}>
              {data.grounded
                ? <><Dot color="var(--pos)" /><span className="muted">Grounded in analyzed insights + reviews</span></>
                : <><Dot color="var(--warn)" /><span className="muted">Fallback: name, category & sample reviews — run Insights for sharper ideas</span></>}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {data && <button className="btn" onClick={copyMarkdown}><Icon.copy size={14} /> Copy markdown</button>}
          <button className="btn btn-primary" onClick={generate} disabled={loading}>
            {loading ? <><Spinner /> Generating ideas…</> : data ? "Regenerate" : "Generate page ideas"}
          </button>
        </div>
      </div>
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {!data && !loading && (
        <Empty icon="spark" title="No page ideas yet">Click “Generate page ideas”. Fetch reviews (and run Insights) first for ideas grounded in real demand.</Empty>
      )}

      {data && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Page / Query", "Keyword", "Angle & how to add", "Slug"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em", borderBottom: "1px solid var(--hairline)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ideas.map((idea, i) => <IdeaRow key={i} idea={idea} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
