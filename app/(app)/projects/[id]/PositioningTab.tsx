"use client";
import { useEffect, useState } from "react";
import { Spinner, Empty } from "@/components/ui";

interface Positioning {
  positioning_statement: string;
  pillars: { title: string; rationale: string; evidence: string[] }[];
  opportunities: { gap: string; competitor_pain: string; our_angle: string }[];
  messaging: string[];
  generated_at?: string;
}

export default function PositioningTab({ projectId, hasMine }: { projectId: string; hasMine: boolean }) {
  const [data, setData] = useState<Positioning | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${projectId}/positioning`).then((r) => r.json()).then((d) => d && setData(d));
  }, [projectId]);

  async function generate() {
    setLoading(true); setErr("");
    const r = await fetch(`/api/projects/${projectId}/positioning`, { method: "POST" });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    else setData(await r.json());
    setLoading(false);
  }

  if (!hasMine)
    return <Empty icon="target" title="Assign your extension first">Mark an extension as “Mine” and add competitors to derive positioning.</Empty>;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 13.5, margin: 0, maxWidth: 560 }}>
          Claude reads competitors’ <strong style={{ color: "var(--text)" }}>negative</strong> reviews and turns their unmet needs into your positioning.
        </p>
        <button className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? <><Spinner /> Deriving positioning…</> : data ? "Regenerate" : "Derive positioning"}
        </button>
      </div>
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {!data && !loading && (
        <Empty icon="spark" title="No positioning yet">Click “Derive positioning” — make sure competitor reviews are fetched first.</Empty>
      )}

      {data && (
        <div style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ padding: 24, borderLeft: "2px solid var(--accent)" }}>
            <div className="eyebrow" style={{ color: "var(--accent)", marginBottom: 10 }}>Positioning statement</div>
            <div className="display" style={{ fontSize: 22, lineHeight: 1.35 }}>{data.positioning_statement}</div>
          </div>

          <div>
            <h3 className="eyebrow" style={{ marginBottom: 13 }}>Differentiation pillars</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {data.pillars.map((p, i) => (
                <div key={i} className="card" style={{ padding: 17 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 7 }}>{p.title}</div>
                  <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55, marginBottom: 11 }}>{p.rationale}</div>
                  {p.evidence?.map((ev, j) => (
                    <div key={j} className="muted" style={{ fontSize: 12.5, paddingLeft: 12, borderLeft: "2px solid var(--hairline)", marginBottom: 5, fontStyle: "italic" }}>“{ev}”</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="eyebrow" style={{ marginBottom: 13 }}>Opportunities from competitor pain</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {data.opportunities.map((o, i) => (
                <div key={i} className="card" style={{ padding: 17, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 5 }}>Gap</div>
                    <div style={{ fontSize: 13.5 }}>{o.gap}</div>
                  </div>
                  <div>
                    <div className="eyebrow" style={{ color: "var(--neg)", marginBottom: 5 }}>They complain</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{o.competitor_pain}</div>
                  </div>
                  <div>
                    <div className="eyebrow" style={{ color: "var(--pos)", marginBottom: 5 }}>Our angle</div>
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>{o.our_angle}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="eyebrow" style={{ marginBottom: 13 }}>Messaging ideas</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {data.messaging.map((m, i) => (
                <div key={i} className="card-quiet" style={{ padding: "11px 16px", fontSize: 14, color: "var(--text-dim)" }}>“{m}”</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
