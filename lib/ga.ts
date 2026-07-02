import { getAccessToken, type ServiceAccount } from "./google-auth";

/*
  Minimal GA4 Data API client (v1beta runReport), no SDK.
  Docs: POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport
*/

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";

interface RunReportResponse {
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  metricHeaders?: { name: string }[];
}

async function runReport(
  sa: ServiceAccount,
  propertyId: string,
  body: Record<string, unknown>
): Promise<RunReportResponse> {
  const token = await getAccessToken(sa);
  const id = propertyId.replace(/^properties\//, "");
  const res = await fetch(`${DATA_API}/properties/${id}:runReport`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as RunReportResponse;
}

export interface GaMetrics {
  activeUsers: number | null;
  pageViews: number | null;
  sessions: number | null;
  geo: { country: string; users: number }[];
  rangeDays: number;
}

function toNum(s: string | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Fetch headline metrics + a country breakdown for a GA4 property over the last
 * `rangeDays` days. Two reports: totals, and users-by-country.
 */
export async function fetchGaMetrics(
  sa: ServiceAccount,
  propertyId: string,
  rangeDays = 28
): Promise<GaMetrics> {
  const dateRanges = [{ startDate: `${rangeDays}daysAgo`, endDate: "yesterday" }];

  const totals = await runReport(sa, propertyId, {
    dateRanges,
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }],
  });

  const totalRow = totals.rows?.[0];
  const headerIndex = (name: string) => totals.metricHeaders?.findIndex((h) => h.name === name) ?? -1;
  const metricAt = (name: string) => {
    const i = headerIndex(name);
    return i >= 0 ? toNum(totalRow?.metricValues?.[i]?.value) : null;
  };

  const geoReport = await runReport(sa, propertyId, {
    dateRanges,
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
    limit: 8,
  });

  const geo =
    geoReport.rows?.map((r) => ({
      country: r.dimensionValues?.[0]?.value || "(unknown)",
      users: toNum(r.metricValues?.[0]?.value) ?? 0,
    })) || [];

  return {
    activeUsers: metricAt("activeUsers"),
    pageViews: metricAt("screenPageViews"),
    sessions: metricAt("sessions"),
    geo,
    rangeDays,
  };
}

/* ---------------------------------------------------------------------------
   Full report: totals + daily time-series + geo + channel sources + top pages.
   Used to power the rich public /p/stats dashboard.
--------------------------------------------------------------------------- */

export interface GaSeriesPoint {
  date: string; // YYYY-MM-DD
  activeUsers: number;
  pageViews: number;
}

export interface GaFull {
  rangeDays: number;
  totals: { activeUsers: number | null; newUsers: number | null; pageViews: number | null; sessions: number | null };
  series: GaSeriesPoint[];
  geo: { country: string; users: number }[];
  sources: { channel: string; sessions: number }[];
  topPages: { path: string; views: number }[];
}

/** Parse GA's compact date dimension ("20260615") into "2026-06-15". */
function gaDate(s: string): string {
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

export async function fetchGaFull(
  sa: ServiceAccount,
  propertyId: string,
  rangeDays = 28
): Promise<GaFull> {
  const dateRanges = [{ startDate: `${rangeDays}daysAgo`, endDate: "yesterday" }];

  const [totalsR, seriesR, geoR, sourcesR, pagesR] = await Promise.all([
    runReport(sa, propertyId, {
      dateRanges,
      metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "screenPageViews" }, { name: "sessions" }],
    }),
    runReport(sa, propertyId, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
      limit: 400,
    }),
    runReport(sa, propertyId, {
      dateRanges,
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 10,
    }),
    runReport(sa, propertyId, {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 8,
    }),
    runReport(sa, propertyId, {
      dateRanges,
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 8,
    }),
  ]);

  const tRow = totalsR.rows?.[0];
  const tIdx = (name: string) => totalsR.metricHeaders?.findIndex((h) => h.name === name) ?? -1;
  const tAt = (name: string) => { const i = tIdx(name); return i >= 0 ? toNum(tRow?.metricValues?.[i]?.value) : null; };

  return {
    rangeDays,
    totals: {
      activeUsers: tAt("activeUsers"),
      newUsers: tAt("newUsers"),
      pageViews: tAt("screenPageViews"),
      sessions: tAt("sessions"),
    },
    series:
      seriesR.rows?.map((r) => ({
        date: gaDate(r.dimensionValues?.[0]?.value || ""),
        activeUsers: toNum(r.metricValues?.[0]?.value) ?? 0,
        pageViews: toNum(r.metricValues?.[1]?.value) ?? 0,
      })) || [],
    geo:
      geoR.rows?.map((r) => ({
        country: r.dimensionValues?.[0]?.value || "(unknown)",
        users: toNum(r.metricValues?.[0]?.value) ?? 0,
      })) || [],
    sources:
      sourcesR.rows?.map((r) => ({
        channel: r.dimensionValues?.[0]?.value || "(unknown)",
        sessions: toNum(r.metricValues?.[0]?.value) ?? 0,
      })) || [],
    topPages:
      pagesR.rows?.map((r) => ({
        path: r.dimensionValues?.[0]?.value || "/",
        views: toNum(r.metricValues?.[0]?.value) ?? 0,
      })) || [],
  };
}

/** Lightweight connectivity check: a 1-metric report. Throws on failure. */
export async function testGaAccess(sa: ServiceAccount, propertyId: string): Promise<number | null> {
  const r = await runReport(sa, propertyId, {
    dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }],
    metrics: [{ name: "activeUsers" }],
  });
  return toNum(r.rows?.[0]?.metricValues?.[0]?.value);
}
