import { NextRequest, NextResponse } from "next/server";
import { buildProjectDigest, renderDigestText, renderDigestMarkdown } from "@/lib/digest";

export const runtime = "nodejs";

/**
 * GET → the "what changed since last check" digest for a project.
 * Returns the structured digest plus rendered text + markdown for preview.
 * Reads the existing snapshots table; no scraping, no side effects.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const digest = buildProjectDigest(id);
    return NextResponse.json({
      digest,
      text: renderDigestText(digest),
      markdown: renderDigestMarkdown(digest),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: msg === "project not found" ? 404 : 500 });
  }
}
