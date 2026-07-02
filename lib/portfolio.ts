import { getDb } from "./db";
import { getLatestGaMetrics, getLatestGaFull } from "./metrics";
import { getExtMeta, type ExtMeta } from "./settings";

/*
  Portfolio roll-up for the public "build in public" page.

  Reads ONLY 'mine' extensions across all projects from the existing `snapshots`
  table (captured on every fetch). No new scraping. Competitor data is never
  queried here, so the public page can't leak it.

  Deltas compare the latest snapshot to the newest snapshot at least ~7 days
  older (the "7-day baseline"). If there's no older snapshot yet, deltas are null.
*/

export interface AppCard {
  ext_id: string;
  name: string;
  slug: string;
  icon: string;
  category: string;
  website: string;
  rating: number | null;
  rating_count: number | null;
  users: string; // raw store text, e.g. "10,000+"
  users_num: number | null; // parsed for aggregation
  review_count: number | null;
  // sparkline series (oldest → newest) of users and rating for tiny charts
  sparkline: { users: (number | null)[]; rating: (number | null)[] };
  // Private metrics (latest) from Google Analytics, null when none captured.
  metrics: {
    ga_active_users: number | null;
    ga_page_views: number | null;
    ga_geo: { country: string; users: number }[];
  } | null;
}

export interface PortfolioTotals {
  apps: number;
  users: number;
  ratings: number; // total rating_count across apps
  reviews: number; // total reviews stored across apps
  avgRating: number | null;
}

export interface PortfolioDeltas {
  users: number | null;
  ratings: number | null;
  reviews: number | null;
  baselineAt: string | null; // the snapshot timestamp we diffed against
}

/** Aggregate GA metrics across apps (present once GA data exists). */
export interface MetricsTotals {
  ga_active_users: number | null;
  ga_page_views: number | null;
  hasData: boolean;
}

export interface Portfolio {
  totals: PortfolioTotals;
  deltas: PortfolioDeltas;
  metrics: MetricsTotals;
  apps: AppCard[];
}

interface SnapRow {
  extension_id: number;
  rating: number | null;
  rating_count: number | null;
  users: string;
  review_count: number | null;
  captured_at: string;
}

/** Parse "10,000+" / "1.2M" / "500" → number, or null. */
export function parseUsers(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KkMm])?/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  if (/k/i.test(m[2] || "")) n *= 1_000;
  if (/m/i.test(m[2] || "")) n *= 1_000_000;
  return Math.round(n);
}

/**
 * Build the public portfolio. `now` is injected for testability/determinism.
 * Distinct by ext_id (an extension may appear in multiple projects as 'mine';
 * we keep the most recently fetched one).
 */
export function buildPortfolio(now: Date = new Date()): Portfolio {
  const db = getDb();

  // All 'mine' extensions, de-duped by ext_id (latest fetch wins).
  const exts = db
    .prepare(
      `SELECT e.* FROM extensions e
       WHERE e.role = 'mine'
       GROUP BY e.ext_id
       HAVING e.id = (
         SELECT e2.id FROM extensions e2
         WHERE e2.ext_id = e.ext_id AND e2.role = 'mine'
         ORDER BY e2.last_fetched DESC, e2.id DESC LIMIT 1
       )
       ORDER BY e.created_at ASC`
    )
    .all() as {
    id: number;
    ext_id: string;
    name: string;
    slug: string;
    icon: string;
    category: string;
    website: string;
    rating: number | null;
    rating_count: number | null;
    users: string;
  }[];

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoffISO = sevenDaysAgo.toISOString().slice(0, 19).replace("T", " ");

  const apps: AppCard[] = [];
  let totalUsers = 0;
  let totalRatings = 0;
  let totalReviews = 0;
  let ratingSum = 0;
  let ratingN = 0;

  // Baseline accumulators (sum across apps at the 7-day-old snapshot).
  let baseUsers = 0;
  let baseRatings = 0;
  let baseReviews = 0;
  let baselineAt: string | null = null;
  let hadBaseline = false;

  // GA aggregate accumulators.
  let mGaUsers = 0, mGaViews = 0;
  let mHasData = false;

  const reviewCountStmt = db.prepare(
    "SELECT COUNT(*) c FROM reviews WHERE extension_id = ?"
  );
  const snapStmt = db.prepare(
    "SELECT extension_id, rating, rating_count, users, review_count, captured_at FROM snapshots WHERE extension_id = ? ORDER BY captured_at ASC, id ASC"
  );

  for (const e of exts) {
    const snaps = snapStmt.all(e.id) as SnapRow[];
    const latest = snaps[snaps.length - 1] || null;

    // Prefer live snapshot values; fall back to the extension row.
    const rating = latest?.rating ?? e.rating;
    const rating_count = latest?.rating_count ?? e.rating_count;
    const usersText = latest?.users || e.users || "";
    const usersNum = parseUsers(usersText);
    const reviewCount =
      latest?.review_count ?? (reviewCountStmt.get(e.id) as { c: number }).c;

    totalUsers += usersNum ?? 0;
    totalRatings += rating_count ?? 0;
    totalReviews += reviewCount ?? 0;
    if (rating != null) {
      ratingSum += rating;
      ratingN++;
    }

    // 7-day baseline: newest snapshot at or before the cutoff.
    const baseline = [...snaps].reverse().find((s) => s.captured_at <= cutoffISO);
    if (baseline) {
      hadBaseline = true;
      baseUsers += parseUsers(baseline.users) ?? 0;
      baseRatings += baseline.rating_count ?? 0;
      baseReviews += baseline.review_count ?? 0;
      if (!baselineAt || baseline.captured_at < baselineAt) baselineAt = baseline.captured_at;
    }

    // Private metrics (latest) from Google Analytics.
    const gaRow = getLatestGaMetrics(e.ext_id);
    const metrics = gaRow
      ? {
          ga_active_users: gaRow.active_users ?? null,
          ga_page_views: gaRow.page_views ?? null,
          ga_geo: gaRow.geo ?? [],
        }
      : null;
    if (metrics) {
      mHasData = true;
      mGaUsers += metrics.ga_active_users ?? 0;
      mGaViews += metrics.ga_page_views ?? 0;
    }

    apps.push({
      ext_id: e.ext_id,
      name: e.name || e.ext_id,
      slug: e.slug,
      icon: e.icon,
      category: e.category,
      website: e.website,
      rating,
      rating_count,
      users: usersText,
      users_num: usersNum,
      review_count: reviewCount,
      sparkline: {
        users: snaps.map((s) => parseUsers(s.users)),
        rating: snaps.map((s) => s.rating),
      },
      metrics,
    });
  }

  const deltas: PortfolioDeltas = hadBaseline
    ? {
        users: totalUsers - baseUsers,
        ratings: totalRatings - baseRatings,
        reviews: totalReviews - baseReviews,
        baselineAt,
      }
    : { users: null, ratings: null, reviews: null, baselineAt: null };

  return {
    totals: {
      apps: apps.length,
      users: totalUsers,
      ratings: totalRatings,
      reviews: totalReviews,
      avgRating: ratingN ? +(ratingSum / ratingN).toFixed(2) : null,
    },
    deltas,
    metrics: mHasData
      ? { ga_active_users: mGaUsers, ga_page_views: mGaViews, hasData: true }
      : { ga_active_users: null, ga_page_views: null, hasData: false },
    apps,
  };
}

/* -------------------------------------------------------------------------- */
/* Full public stats dashboard (GA aggregated across all 'mine' apps + manual) */
/* -------------------------------------------------------------------------- */

export interface PublicStats {
  hasGa: boolean;
  rangeDays: number;
  ga: {
    activeUsers: number | null;
    newUsers: number | null;
    pageViews: number | null;
    sessions: number | null;
    series: { date: string; activeUsers: number; pageViews: number }[];
    geo: { country: string; users: number; pct: number }[];
    sources: { channel: string; sessions: number; pct: number }[];
    topPages: { path: string; views: number }[];
  };
  capturedAt: string | null;
}

/** Distinct 'mine' ext_ids across all projects. */
function mineExtIds(): string[] {
  return (getDb().prepare("SELECT DISTINCT ext_id FROM extensions WHERE role='mine'").all() as { ext_id: string }[]).map(
    (r) => r.ext_id
  );
}

export function buildPublicStats(): PublicStats {
  const ids = mineExtIds();

  // --- GA: aggregate across apps ---
  const seriesMap = new Map<string, { activeUsers: number; pageViews: number }>();
  const geoMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const pageMap = new Map<string, number>();
  let gaActive = 0, gaNew = 0, gaViews = 0, gaSessions = 0;
  let hasGa = false;
  let rangeDays = 28;
  let capturedAt: string | null = null;

  for (const id of ids) {
    const full = getLatestGaFull(id);
    if (!full) continue;
    hasGa = true;
    rangeDays = full.rangeDays || rangeDays;
    if (!capturedAt || full.captured_at > capturedAt) capturedAt = full.captured_at;
    gaActive += full.totals.activeUsers ?? 0;
    gaNew += full.totals.newUsers ?? 0;
    gaViews += full.totals.pageViews ?? 0;
    gaSessions += full.totals.sessions ?? 0;
    for (const p of full.series) {
      const cur = seriesMap.get(p.date) || { activeUsers: 0, pageViews: 0 };
      cur.activeUsers += p.activeUsers;
      cur.pageViews += p.pageViews;
      seriesMap.set(p.date, cur);
    }
    for (const g of full.geo) geoMap.set(g.country, (geoMap.get(g.country) || 0) + g.users);
    for (const s of full.sources) sourceMap.set(s.channel, (sourceMap.get(s.channel) || 0) + s.sessions);
    for (const tp of full.topPages) pageMap.set(tp.path, (pageMap.get(tp.path) || 0) + tp.views);
  }

  const series = [...seriesMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  const geoTotal = [...geoMap.values()].reduce((a, b) => a + b, 0) || 1;
  const geo = [...geoMap.entries()]
    .map(([country, users]) => ({ country, users, pct: +((users / geoTotal) * 100).toFixed(1) }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 8);
  const srcTotal = [...sourceMap.values()].reduce((a, b) => a + b, 0) || 1;
  const sources = [...sourceMap.entries()]
    .map(([channel, sessions]) => ({ channel, sessions, pct: +((sessions / srcTotal) * 100).toFixed(1) }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);
  const topPages = [...pageMap.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  return {
    hasGa,
    rangeDays,
    ga: {
      activeUsers: hasGa ? gaActive : null,
      newUsers: hasGa ? gaNew : null,
      pageViews: hasGa ? gaViews : null,
      sessions: hasGa ? gaSessions : null,
      series,
      geo,
      sources,
      topPages,
    },
    capturedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Single-extension public detail (his per-app page)                         */
/* -------------------------------------------------------------------------- */

export interface PublicApp {
  ext_id: string;
  name: string;
  slug: string;
  icon: string;
  category: string;
  rating: number | null;
  rating_count: number | null;
  users: string;
  meta: ExtMeta;
  ratingSeries: { date: string; rating: number | null }[];
  usersSeries: { date: string; users: number | null }[];
  ga: {
    activeUsers: number | null; newUsers: number | null; pageViews: number | null; sessions: number | null;
    series: { date: string; activeUsers: number; pageViews: number }[];
    geo: { country: string; users: number }[];
    captured_at: string;
  } | null;
}

/** Full public detail for ONE 'mine' extension, or null if not found/mine. */
export function buildPublicApp(extId: string): PublicApp | null {
  const db = getDb();
  const e = db
    .prepare(
      `SELECT * FROM extensions WHERE ext_id = ? AND role = 'mine'
       ORDER BY last_fetched DESC, id DESC LIMIT 1`
    )
    .get(extId) as
    | { id: number; ext_id: string; name: string; slug: string; icon: string; category: string; rating: number | null; rating_count: number | null; users: string }
    | undefined;
  if (!e) return null;

  const snaps = db
    .prepare("SELECT rating, users, captured_at FROM snapshots WHERE extension_id = ? ORDER BY captured_at ASC, id ASC")
    .all(e.id) as { rating: number | null; users: string; captured_at: string }[];

  const gaFull = getLatestGaFull(extId);

  return {
    ext_id: e.ext_id,
    name: e.name || e.ext_id,
    slug: e.slug,
    icon: e.icon,
    category: e.category,
    rating: e.rating,
    rating_count: e.rating_count,
    users: e.users,
    meta: getExtMeta(extId),
    ratingSeries: snaps.map((s) => ({ date: s.captured_at.slice(0, 10), rating: s.rating })),
    usersSeries: snaps.map((s) => ({ date: s.captured_at.slice(0, 10), users: parseUsers(s.users) })),
    ga: gaFull
      ? {
          activeUsers: gaFull.totals.activeUsers,
          newUsers: gaFull.totals.newUsers,
          pageViews: gaFull.totals.pageViews,
          sessions: gaFull.totals.sessions,
          series: gaFull.series,
          geo: gaFull.geo,
          captured_at: gaFull.captured_at,
        }
      : null,
  };
}
