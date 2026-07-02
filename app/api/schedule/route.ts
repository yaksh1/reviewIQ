import { NextRequest, NextResponse } from "next/server";
import { getSchedule, saveSchedule } from "@/lib/settings";
import { reloadScheduler, schedulerStatus, runScrapeNow } from "@/lib/scheduler";

export const runtime = "nodejs";
export const maxDuration = 600;

/** GET → current schedule config + runtime status. */
export async function GET() {
  return NextResponse.json(schedulerStatus());
}

/**
 * POST → save config and/or run now.
 * Body: { enabled?, intervalHours?, action?: "save" | "runNow" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "runNow") {
    // Kick a scrape but don't block the response on the full crawl.
    void runScrapeNow();
    return NextResponse.json({ ok: true, status: schedulerStatus() });
  }

  const patch: { enabled?: boolean; intervalHours?: number } = {};
  if ("enabled" in body) patch.enabled = !!body.enabled;
  if ("intervalHours" in body) patch.intervalHours = Number(body.intervalHours);
  saveSchedule(patch);
  reloadScheduler();

  return NextResponse.json({ ok: true, status: schedulerStatus(), config: getSchedule() });
}
