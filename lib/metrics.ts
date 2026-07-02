import { getDb } from "./db";
import { fetchGaFull, type GaFull } from "./ga";
import { getGaServiceAccountJson, getGaProperties } from "./settings";
import { isServiceAccount, type ServiceAccount } from "./google-auth";

/*
  Read/write helpers for GA4 metrics (ga_metrics): fetched from the Data API with
  the uploaded service account, dated so they trend, and feeding the public page.
*/

/* ----------------------------- GA4 ----------------------------- */

function loadServiceAccount(): ServiceAccount {
  const json = getGaServiceAccountJson();
  if (!json) throw new Error("No Google service account configured.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Stored service-account JSON is invalid.");
  }
  if (!isServiceAccount(parsed)) throw new Error("Service-account JSON missing client_email/private_key.");
  return parsed;
}

/** Fetch the full GA report for one extension (mapped property) and persist. */
export async function captureGaMetrics(extId: string, rangeDays = 28): Promise<GaFull> {
  const propertyId = getGaProperties()[extId];
  if (!propertyId) throw new Error(`No GA4 property mapped for ${extId}.`);
  const sa = loadServiceAccount();
  const m = await fetchGaFull(sa, propertyId, rangeDays);
  getDb()
    .prepare(
      `INSERT INTO ga_metrics
        (ext_id, property_id, range_days, active_users, new_users, page_views, sessions, geo, report)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      extId, propertyId, m.rangeDays,
      m.totals.activeUsers, m.totals.newUsers, m.totals.pageViews, m.totals.sessions,
      JSON.stringify(m.geo), JSON.stringify(m)
    );
  return m;
}

export interface GaMetricsRow {
  ext_id: string;
  property_id: string;
  range_days: number | null;
  active_users: number | null;
  new_users: number | null;
  page_views: number | null;
  sessions: number | null;
  geo: { country: string; users: number }[];
  captured_at: string;
}

export function getLatestGaMetrics(extId: string): GaMetricsRow | null {
  const row = getDb()
    .prepare("SELECT * FROM ga_metrics WHERE ext_id = ? ORDER BY captured_at DESC, id DESC LIMIT 1")
    .get(extId) as Record<string, unknown> | undefined;
  if (!row) return null;
  let geo: { country: string; users: number }[] = [];
  try {
    geo = JSON.parse((row.geo as string) || "[]");
  } catch {
    geo = [];
  }
  return {
    ext_id: row.ext_id as string,
    property_id: row.property_id as string,
    range_days: row.range_days as number | null,
    active_users: row.active_users as number | null,
    new_users: (row.new_users as number | null) ?? null,
    page_views: row.page_views as number | null,
    sessions: row.sessions as number | null,
    geo,
    captured_at: row.captured_at as string,
  };
}

/** The latest full GA report blob for an extension (for the dashboard), or null. */
export function getLatestGaFull(extId: string): (GaFull & { captured_at: string }) | null {
  const row = getDb()
    .prepare("SELECT report, captured_at FROM ga_metrics WHERE ext_id = ? AND report != '' ORDER BY captured_at DESC, id DESC LIMIT 1")
    .get(extId) as { report: string; captured_at: string } | undefined;
  if (!row) return null;
  try {
    return { ...(JSON.parse(row.report) as GaFull), captured_at: row.captured_at };
  } catch {
    return null;
  }
}

