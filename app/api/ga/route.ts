import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  getGaConfigView,
  saveGaServiceAccount,
  setGaProperty,
  getGaServiceAccountJson,
  getGaProperties,
} from "@/lib/settings";
import { isServiceAccount } from "@/lib/google-auth";
import { testGaAccess } from "@/lib/ga";
import { captureGaMetrics, getLatestGaMetrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const maxDuration = 300;

/** GET → config (masked) + 'mine' extensions with their mapped property + last sync. */
export async function GET() {
  const cfg = getGaConfigView();
  const db = getDb();
  const exts = db
    .prepare("SELECT DISTINCT ext_id, name FROM extensions WHERE role = 'mine'")
    .all() as { ext_id: string; name: string }[];
  const apps = exts.map((e) => {
    const last = getLatestGaMetrics(e.ext_id);
    return {
      ext_id: e.ext_id,
      name: e.name || e.ext_id,
      property_id: cfg.properties[e.ext_id] || "",
      last_sync: last?.captured_at || null,
      active_users: last?.active_users ?? null,
    };
  });
  return NextResponse.json({ ...cfg, apps });
}

/**
 * POST actions:
 *  { action: "saveKey", saJson }          → store the service-account JSON (encrypted)
 *  { action: "clearKey" }                 → remove it
 *  { action: "setProperty", extId, propertyId }
 *  { action: "test", extId }              → verify access to that property
 *  { action: "sync", extId? }             → fetch+persist GA metrics (all mine, or one)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "saveKey") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.saJson);
    } catch {
      return NextResponse.json({ error: "That isn't valid JSON." }, { status: 400 });
    }
    if (!isServiceAccount(parsed)) {
      return NextResponse.json(
        { error: "JSON is missing client_email / private_key — upload the service-account key file." },
        { status: 400 }
      );
    }
    saveGaServiceAccount(body.saJson, (parsed as { client_email: string }).client_email);
    return NextResponse.json({ ok: true, config: getGaConfigView() });
  }

  if (action === "clearKey") {
    saveGaServiceAccount("");
    return NextResponse.json({ ok: true, config: getGaConfigView() });
  }

  if (action === "setProperty") {
    if (!body.extId) return NextResponse.json({ error: "extId required" }, { status: 400 });
    setGaProperty(body.extId, String(body.propertyId || ""));
    return NextResponse.json({ ok: true, config: getGaConfigView() });
  }

  if (action === "test") {
    if (!getGaServiceAccountJson()) return NextResponse.json({ ok: false, error: "No key uploaded." });
    const propertyId = getGaProperties()[body.extId];
    if (!propertyId) return NextResponse.json({ ok: false, error: "No property mapped for this app." });
    try {
      const sa = JSON.parse(getGaServiceAccountJson() as string);
      const users = await testGaAccess(sa, propertyId);
      return NextResponse.json({ ok: true, activeUsers: users });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (action === "sync") {
    const db = getDb();
    const ids: string[] = body.extId
      ? [body.extId]
      : (db.prepare("SELECT DISTINCT ext_id FROM extensions WHERE role='mine'").all() as { ext_id: string }[]).map(
          (r) => r.ext_id
        );
    const results: { ext_id: string; ok: boolean; activeUsers?: number | null; error?: string }[] = [];
    for (const extId of ids) {
      try {
        const m = await captureGaMetrics(extId);
        results.push({ ext_id: extId, ok: true, activeUsers: m.totals.activeUsers });
      } catch (e) {
        results.push({ ext_id: extId, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
