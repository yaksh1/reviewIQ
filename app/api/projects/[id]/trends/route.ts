import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { Extension } from "@/lib/types";

export const runtime = "nodejs";

interface SnapshotRow {
  id: number;
  extension_id: number;
  rating: number | null;
  rating_count: number | null;
  users: string;
  review_count: number | null;
  sentiment: string;
  themes: string;
  captured_at: string;
}

function safeParse<T>(s: string): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

// Normalize a theme label so minor AI re-wording still matches across snapshots:
// lowercase, strip punctuation, drop stopwords, keep the 3 most significant words sorted.
const STOP = new Set(["the", "a", "an", "of", "to", "and", "or", "vs", "for", "in", "on", "with", "some", "no", "not", "loses"]);
function themeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .sort()
    .slice(0, 3)
    .join(" ");
}

/** Diff two theme sets → which themes rose/fell/appeared since the prior snapshot. */
function diffThemes(
  prev: { theme: string; count: number }[] | undefined,
  cur: { theme: string; count: number }[] | undefined
) {
  const p = new Map((prev || []).map((t) => [themeKey(t.theme), t.count]));
  const out: { theme: string; count: number; delta: number | null }[] = [];
  for (const t of cur || []) {
    const before = p.get(themeKey(t.theme));
    out.push({ theme: t.theme, count: t.count, delta: before == null ? null : t.count - before });
  }
  return out;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const exts = db
    .prepare("SELECT * FROM extensions WHERE project_id = ? ORDER BY role='mine' DESC, created_at ASC")
    .all(id) as Extension[];

  const series = exts.map((ext) => {
    const rows = db
      .prepare("SELECT * FROM snapshots WHERE extension_id = ? ORDER BY captured_at ASC, id ASC")
      .all(ext.id) as SnapshotRow[];

    const points = rows.map((r) => ({
      captured_at: r.captured_at,
      rating: r.rating,
      rating_count: r.rating_count,
      review_count: r.review_count,
      users: r.users,
      sentiment: safeParse<{ positive: number; neutral: number; negative: number }>(r.sentiment),
      themes: safeParse<{ praises: { theme: string; count: number }[]; complaints: { theme: string; count: number }[] }>(r.themes),
    }));

    // Diff: latest vs previous snapshot.
    const last = points[points.length - 1];
    const prev = points.length >= 2 ? points[points.length - 2] : null;
    const diff = last
      ? {
          rating_delta: prev && last.rating != null && prev.rating != null ? +(last.rating - prev.rating).toFixed(2) : null,
          rating_count_delta: prev && last.rating_count != null && prev.rating_count != null ? last.rating_count - prev.rating_count : null,
          review_count_delta: prev && last.review_count != null && prev.review_count != null ? last.review_count - prev.review_count : null,
          complaints: diffThemes(prev?.themes?.complaints, last.themes?.complaints),
          praises: diffThemes(prev?.themes?.praises, last.themes?.praises),
          from: prev?.captured_at ?? null,
          to: last.captured_at,
        }
      : null;

    return {
      extension_id: ext.id,
      name: ext.name || ext.ext_id,
      role: ext.role,
      icon: ext.icon,
      points,
      diff,
    };
  });

  return NextResponse.json({ series });
}
