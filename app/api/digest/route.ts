import { NextRequest, NextResponse } from "next/server";
import { getDigestConfigView, saveDigestConfig, type DigestChannel } from "@/lib/settings";
import { deliverDigests } from "@/lib/notify";

export const runtime = "nodejs";
export const maxDuration = 120;

const CHANNELS: DigestChannel[] = ["none", "webhook", "email"];

/** GET → masked digest delivery config. */
export async function GET() {
  return NextResponse.json(getDigestConfigView());
}

/**
 * POST → save config, or send a test digest now.
 * Body: { action?: "save" | "test", enabled?, channel?, onlyWhenChanged?,
 *         webhookUrl?, emailApiKey?, emailFrom?, emailTo? }
 * Secret fields follow keep/clear/set: omit=keep, ""=clear, string=set.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.channel !== undefined && !CHANNELS.includes(body.channel)) {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }

  // Both save and test persist the submitted config first (so "test" tests
  // exactly what's in the form — an explicit, expected save, not a hidden one).
  const view = applySave(body);

  if (body.action === "test") {
    const result = await deliverDigests();
    return NextResponse.json({ ...result, config: view });
  }
  return NextResponse.json({ ok: true, config: view });
}

function applySave(body: Record<string, unknown>) {
  return saveDigestConfig({
    enabled: body.enabled as boolean | undefined,
    channel: body.channel as DigestChannel | undefined,
    onlyWhenChanged: body.onlyWhenChanged as boolean | undefined,
    webhookUrl: body.webhookUrl as string | undefined,
    emailApiKey: body.emailApiKey as string | undefined,
    emailFrom: body.emailFrom as string | undefined,
    emailTo: body.emailTo as string | undefined,
  });
}
