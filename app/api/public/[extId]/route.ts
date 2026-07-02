import { NextRequest, NextResponse } from "next/server";
import { buildPublicApp } from "@/lib/portfolio";
import { getPublicProfile } from "@/lib/settings";

export const runtime = "nodejs";

/** Public per-extension detail. Gated by the public profile's enabled flag. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ extId: string }> }) {
  const profile = getPublicProfile();
  if (!profile.enabled) return NextResponse.json({ enabled: false });
  const { extId } = await params;
  const app = buildPublicApp(extId);
  if (!app) return NextResponse.json({ enabled: true, app: null }, { status: 404 });
  return NextResponse.json({ enabled: true, profile: { name: profile.name }, app });
}
