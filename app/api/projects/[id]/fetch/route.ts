import { NextRequest, NextResponse } from "next/server";
import { fetchProject } from "@/lib/fetch-project";

export const runtime = "nodejs";
export const maxDuration = 600;

/** Fetch (scrape) reviews for every extension in a project. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { results, months_back } = await fetchProject(id);
    return NextResponse.json({ results, months_back });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg === "project not found" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
