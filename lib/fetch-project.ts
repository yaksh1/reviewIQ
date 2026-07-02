import { getDb } from "./db";
import { scrapeExtension } from "./scraper";
import type { Extension } from "./types";

export interface FetchExtResult {
  ext_id: string;
  ok: boolean;
  reviews?: number;
  error?: string;
}

export interface FetchProjectResult {
  project_id: number;
  months_back: number;
  results: FetchExtResult[];
}

/**
 * Scrape every extension in a project: update metadata, insert new reviews,
 * and record a dated trend snapshot per extension. Shared by the manual
 * /fetch route and the background scheduler so both stay in sync.
 */
export async function fetchProject(projectId: number | string): Promise<FetchProjectResult> {
  const db = getDb();

  const project = db
    .prepare("SELECT id, months_back FROM projects WHERE id = ?")
    .get(projectId) as { id: number; months_back: number } | undefined;
  if (!project) {
    throw new Error("project not found");
  }

  const monthsBack = project.months_back ?? 2;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

  const exts = db
    .prepare("SELECT * FROM extensions WHERE project_id = ?")
    .all(project.id) as Extension[];

  const results: FetchExtResult[] = [];

  for (const ext of exts) {
    try {
      const { meta, reviews } = await scrapeExtension(ext.ext_id, {
        cutoffDate,
        maxReviews: 1000,
      });

      db.prepare(
        `UPDATE extensions SET name=?, slug=?, icon=?, rating=?, rating_count=?, users=?, description=?, category=?, last_fetched=datetime('now') WHERE id=?`
      ).run(
        meta.name || ext.name,
        meta.slug,
        meta.icon,
        meta.rating,
        meta.rating_count,
        meta.users,
        meta.description || "",
        meta.category || "",
        ext.id
      );

      const insert = db.prepare(
        `INSERT OR IGNORE INTO reviews (extension_id, review_uid, author, rating, body, date)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      const tx = db.transaction((rows: typeof reviews) => {
        for (const r of rows)
          insert.run(ext.id, r.review_uid, r.author, r.rating, r.body, r.date);
      });
      tx(reviews);

      // Record a dated trend snapshot of current metrics. Sentiment/themes
      // are filled in later when Insights runs for this project.
      const reviewCount = (
        db.prepare("SELECT COUNT(*) c FROM reviews WHERE extension_id = ?").get(ext.id) as { c: number }
      ).c;
      db.prepare(
        `INSERT INTO snapshots (extension_id, project_id, rating, rating_count, users, review_count)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(ext.id, ext.project_id, meta.rating, meta.rating_count, meta.users, reviewCount);

      results.push({ ext_id: ext.ext_id, ok: true, reviews: reviews.length });
    } catch (e) {
      results.push({ ext_id: ext.ext_id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { project_id: project.id, months_back: monthsBack, results };
}

/** Scrape every project. Used by the scheduler. Returns per-project results. */
export async function fetchAllProjects(): Promise<FetchProjectResult[]> {
  const db = getDb();
  const ids = db.prepare("SELECT id FROM projects ORDER BY id ASC").all() as { id: number }[];
  const out: FetchProjectResult[] = [];
  for (const { id } of ids) {
    try {
      out.push(await fetchProject(id));
    } catch (e) {
      out.push({
        project_id: id,
        months_back: 0,
        results: [{ ext_id: "", ok: false, error: e instanceof Error ? e.message : String(e) }],
      });
    }
  }
  return out;
}
