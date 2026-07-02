import { NextResponse } from "next/server";
import { buildPortfolio, buildPublicStats } from "@/lib/portfolio";
import { getPublicProfile } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * Public, mine-only data for the build-in-public site (home, stats, apps).
 * Returns the editable profile + portfolio + the full GA/manual stats dashboard.
 * No competitor data, no secrets. Disabled → { enabled: false } only.
 */
export async function GET() {
  const profile = getPublicProfile();
  if (!profile.enabled) {
    return NextResponse.json({ enabled: false });
  }
  const portfolio = buildPortfolio();
  const stats = buildPublicStats();
  return NextResponse.json({ enabled: true, profile, ...portfolio, stats });
}
