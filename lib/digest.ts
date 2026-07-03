import { getDb } from "./db";
import type { Extension } from "./types";

/*
  Digest engine — "what changed since last time" for a project.

  Pure read logic over the existing `snapshots` table (the same dated captures
  the Trends tab uses). It diffs the two most recent snapshots per extension and
  rolls them up into a per-project digest: rating / review-count / rating-count
  movement plus which complaint & praise themes rose, fell, or newly appeared.

  This module has NO delivery concern — it only produces the digest object and a
  rendered text/markdown body. Delivery (email, webhook) is layered on separately.
*/

/* ---- theme matching (shared shape with the trends route) ---- */

const STOP = new Set([
  "the", "a", "an", "of", "to", "and", "or", "vs", "for", "in", "on", "with",
  "some", "no", "not", "loses",
]);

/** Normalize a theme label so minor AI re-wording still matches across snapshots. */
export function themeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .sort()
    .slice(0, 3)
    .join(" ");
}

export interface ThemeChange {
  theme: string;
  count: number;
  delta: number | null; // null = newly appeared (no prior)
}

/** Diff two theme sets → each current theme with its change vs the prior set. */
export function diffThemes(
  prev: { theme: string; count: number }[] | undefined,
  cur: { theme: string; count: number }[] | undefined
): ThemeChange[] {
  const p = new Map((prev || []).map((t) => [themeKey(t.theme), t.count]));
  return (cur || []).map((t) => {
    const before = p.get(themeKey(t.theme));
    return { theme: t.theme, count: t.count, delta: before == null ? null : t.count - before };
  });
}

/* ---- snapshot reading ---- */

interface SnapshotRow {
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  users: string;
  sentiment: string;
  themes: string;
  captured_at: string;
}

interface Themes {
  praises: { theme: string; count: number }[];
  complaints: { theme: string; count: number }[];
}

function safeParse<T>(s: string): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

/* ---- digest shape ---- */

export interface ExtensionDigest {
  extension_id: number;
  name: string;
  role: "mine" | "competitor";
  rating: number | null;
  ratingDelta: number | null;
  ratingCountDelta: number | null;
  reviewCountDelta: number | null;
  /** Complaint themes that newly appeared or rose since the prior snapshot. */
  risingComplaints: ThemeChange[];
  /** Praise themes that newly appeared or rose. */
  risingPraises: ThemeChange[];
  from: string | null;
  to: string;
}

export interface ProjectDigest {
  project_id: number;
  project_name: string;
  from: string | null; // earliest "prev" snapshot across extensions
  to: string | null; // latest snapshot
  extensions: ExtensionDigest[];
  /** True if anything actually moved (deltas or new themes). */
  hasChanges: boolean;
}

/** Only rising/new themes matter for a digest (things that got worse or emerged). */
function rising(changes: ThemeChange[]): ThemeChange[] {
  return changes
    .filter((c) => c.delta == null || c.delta > 0)
    .sort((a, b) => (b.delta ?? Infinity) - (a.delta ?? Infinity))
    .slice(0, 5);
}

/** Build the digest for one project by diffing the latest two snapshots per ext. */
export function buildProjectDigest(projectId: number | string): ProjectDigest {
  const db = getDb();
  const project = db
    .prepare("SELECT id, name FROM projects WHERE id = ?")
    .get(projectId) as { id: number; name: string } | undefined;
  if (!project) throw new Error("project not found");

  const exts = db
    .prepare("SELECT * FROM extensions WHERE project_id = ? ORDER BY role='mine' DESC, created_at ASC")
    .all(project.id) as Extension[];

  let overallFrom: string | null = null;
  let overallTo: string | null = null;
  const extensions: ExtensionDigest[] = [];

  for (const ext of exts) {
    const rows = db
      .prepare(
        "SELECT rating, rating_count, review_count, users, sentiment, themes, captured_at FROM snapshots WHERE extension_id = ? ORDER BY captured_at DESC, id DESC LIMIT 2"
      )
      .all(ext.id) as SnapshotRow[];
    if (rows.length === 0) continue;

    const last = rows[0];
    const prev = rows[1] ?? null; // rows are newest-first

    const lastThemes = safeParse<Themes>(last.themes);
    const prevThemes = prev ? safeParse<Themes>(prev.themes) : null;

    const ratingDelta =
      prev && last.rating != null && prev.rating != null
        ? +(last.rating - prev.rating).toFixed(2)
        : null;
    const ratingCountDelta =
      prev && last.rating_count != null && prev.rating_count != null
        ? last.rating_count - prev.rating_count
        : null;
    const reviewCountDelta =
      prev && last.review_count != null && prev.review_count != null
        ? last.review_count - prev.review_count
        : null;

    extensions.push({
      extension_id: ext.id,
      name: ext.name || ext.ext_id,
      role: ext.role,
      rating: last.rating,
      ratingDelta,
      ratingCountDelta,
      reviewCountDelta,
      risingComplaints: rising(diffThemes(prevThemes?.complaints, lastThemes?.complaints)),
      risingPraises: rising(diffThemes(prevThemes?.praises, lastThemes?.praises)),
      from: prev?.captured_at ?? null,
      to: last.captured_at,
    });

    if (prev && (!overallFrom || prev.captured_at < overallFrom)) overallFrom = prev.captured_at;
    if (!overallTo || last.captured_at > overallTo) overallTo = last.captured_at;
  }

  const hasChanges = extensions.some(
    (e) =>
      (e.ratingDelta != null && e.ratingDelta !== 0) ||
      (e.ratingCountDelta != null && e.ratingCountDelta !== 0) ||
      (e.reviewCountDelta != null && e.reviewCountDelta !== 0) ||
      e.risingComplaints.length > 0 ||
      e.risingPraises.length > 0
  );

  return {
    project_id: project.id,
    project_name: project.name,
    from: overallFrom,
    to: overallTo,
    extensions,
    hasChanges,
  };
}

/* ---- rendering ---- */

function fmtDelta(n: number | null, opts: { plus?: boolean; suffix?: string } = {}): string {
  if (n == null) return "";
  const sign = n > 0 ? "+" : "";
  return ` (${sign}${n}${opts.suffix ?? ""})`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T") + (iso.includes("T") ? "" : "Z"));
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Render a digest as plain text (for email/console). */
export function renderDigestText(d: ProjectDigest): string {
  const lines: string[] = [];
  lines.push(`ReviewIQ digest — ${d.project_name}`);
  if (d.from && d.to) lines.push(`Changes ${fmtDate(d.from)} → ${fmtDate(d.to)}`);
  lines.push("");

  if (!d.hasChanges) {
    lines.push("No notable changes since the last check.");
    return lines.join("\n");
  }

  for (const e of d.extensions) {
    const bits: string[] = [];
    if (e.ratingDelta != null && e.ratingDelta !== 0) bits.push(`rating ${e.rating}★${fmtDelta(e.ratingDelta)}`);
    if (e.ratingCountDelta != null && e.ratingCountDelta !== 0) bits.push(`${fmtDelta(e.ratingCountDelta).trim()} ratings`);
    if (e.reviewCountDelta != null && e.reviewCountDelta !== 0) bits.push(`${fmtDelta(e.reviewCountDelta).trim()} reviews`);
    const hasThemeMoves = e.risingComplaints.length || e.risingPraises.length;
    if (!bits.length && !hasThemeMoves) continue;

    lines.push(`• ${e.name}${e.role === "mine" ? " (yours)" : ""}`);
    if (bits.length) lines.push(`    ${bits.join(", ")}`);
    if (e.risingComplaints.length)
      lines.push(`    ↑ complaints: ${e.risingComplaints.map((c) => `${c.theme}${fmtDelta(c.delta)}`).join(", ")}`);
    if (e.risingPraises.length)
      lines.push(`    ↑ praises: ${e.risingPraises.map((c) => `${c.theme}${fmtDelta(c.delta)}`).join(", ")}`);
  }

  return lines.join("\n");
}

/** Render a digest as Markdown (for webhooks / richer channels). */
export function renderDigestMarkdown(d: ProjectDigest): string {
  const lines: string[] = [];
  lines.push(`**ReviewIQ digest — ${d.project_name}**`);
  if (d.from && d.to) lines.push(`_Changes ${fmtDate(d.from)} → ${fmtDate(d.to)}_`);
  lines.push("");

  if (!d.hasChanges) {
    lines.push("No notable changes since the last check.");
    return lines.join("\n");
  }

  for (const e of d.extensions) {
    const bits: string[] = [];
    if (e.ratingDelta != null && e.ratingDelta !== 0) bits.push(`rating ${e.rating}★${fmtDelta(e.ratingDelta)}`);
    if (e.ratingCountDelta != null && e.ratingCountDelta !== 0) bits.push(`${fmtDelta(e.ratingCountDelta).trim()} ratings`);
    if (e.reviewCountDelta != null && e.reviewCountDelta !== 0) bits.push(`${fmtDelta(e.reviewCountDelta).trim()} reviews`);
    const hasThemeMoves = e.risingComplaints.length || e.risingPraises.length;
    if (!bits.length && !hasThemeMoves) continue;

    lines.push(`**${e.name}**${e.role === "mine" ? " _(yours)_" : ""}`);
    if (bits.length) lines.push(`- ${bits.join(", ")}`);
    if (e.risingComplaints.length)
      lines.push(`- ⚠️ complaints up: ${e.risingComplaints.map((c) => `${c.theme}${fmtDelta(c.delta)}`).join(", ")}`);
    if (e.risingPraises.length)
      lines.push(`- ✅ praises up: ${e.risingPraises.map((c) => `${c.theme}${fmtDelta(c.delta)}`).join(", ")}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

/** Build digests for every project (used by scheduled digest delivery). */
export function buildAllDigests(): ProjectDigest[] {
  const ids = getDb().prepare("SELECT id FROM projects ORDER BY id ASC").all() as { id: number }[];
  return ids.map((r) => buildProjectDigest(r.id));
}
