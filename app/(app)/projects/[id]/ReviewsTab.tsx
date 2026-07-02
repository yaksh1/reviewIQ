"use client";
import { useCallback, useEffect, useState } from "react";
import { Spinner, Stars, Empty } from "@/components/ui";
import type { ExtWithCount } from "./page";

interface ReviewRow {
  id: number;
  author: string;
  rating: number | null;
  body: string;
  date: string;
  reply: string | null;
}

export default function ReviewsTab({
  projectId,
  mine,
}: {
  projectId: string;
  mine?: ExtWithCount;
}) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!mine) return;
    setLoading(true);
    const r = await fetch(`/api/extensions/${mine.id}/reviews`);
    setReviews(await r.json());
    setLoading(false);
  }, [mine]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true); setErr("");
    const r = await fetch(`/api/projects/${projectId}/replies`, { method: "POST" });
    if (!r.ok) setErr((await r.json()).error || "Failed");
    setGenerating(false);
    await load();
  }

  if (!mine)
    return <Empty icon="target" title="No “mine” extension assigned">Mark one extension as “Mine” in the Extensions tab to see and reply to its reviews.</Empty>;

  const withReplies = reviews.filter((r) => r.reply).length;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{mine.name || mine.ext_id}</div>
          <div className="muted" style={{ fontSize: 13 }}><span className="mono">{reviews.length}</span> reviews · <span className="mono">{withReplies}</span> AI replies drafted</div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating || reviews.length === 0}>
          {generating ? <><Spinner /> Claude is drafting replies…</> : "Generate replies"}
        </button>
      </div>
      {err && <div style={{ color: "var(--neg)", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>
      ) : reviews.length === 0 ? (
        <Empty icon="chat" title="No reviews fetched">Go to the Extensions tab and click “Fetch / refresh all reviews”.</Empty>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {reviews.map((r) => (
            <div key={r.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.author || "Anonymous"}</span>
                  <Stars n={r.rating} />
                </div>
                <span className="muted" style={{ fontSize: 12.5 }}>{r.date}</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" }}>{r.body || <span className="muted">(no text)</span>}</div>
              {r.reply && (
                <div style={{ marginTop: 12, padding: "11px 14px", background: "var(--accent-wash)", borderLeft: "2px solid var(--accent)", borderRadius: "0 8px 8px 0" }}>
                  <div className="eyebrow" style={{ color: "var(--accent)", marginBottom: 5 }}>Suggested reply</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{r.reply}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
