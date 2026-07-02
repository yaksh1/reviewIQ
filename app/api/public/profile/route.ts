import { NextRequest, NextResponse } from "next/server";
import { getPublicProfile, savePublicProfile, type PublicProfile } from "@/lib/settings";

export const runtime = "nodejs";

/** GET → the current editable profile (for the Settings UI). */
export async function GET() {
  return NextResponse.json(getPublicProfile());
}

/** POST → save profile fields. Only known keys are persisted. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<PublicProfile>;
  const allowed: (keyof PublicProfile)[] = [
    "enabled",
    "name",
    "tagline",
    "goal",
    "profit",
    "startDate",
    "youtube",
    "twitter",
    "website",
  ];
  const patch: Partial<PublicProfile> = {};
  for (const k of allowed) {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  }
  const saved = savePublicProfile(patch);
  return NextResponse.json({ ok: true, profile: saved });
}
