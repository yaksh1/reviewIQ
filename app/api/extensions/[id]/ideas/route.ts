import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generatePageIdeas, type InsightsResult } from "@/lib/analysis";
import type { Extension, Review } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cached = getDb()
    .prepare("SELECT data, grounded, created_at FROM page_ideas WHERE extension_id = ?")
    .get(id) as { data: string; grounded: number; created_at: string } | undefined;
  if (!cached) return NextResponse.json(null);
  return NextResponse.json({
    ideas: JSON.parse(cached.data),
    grounded: !!cached.grounded,
    generated_at: cached.created_at,
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const ext = db.prepare("SELECT * FROM extensions WHERE id = ?").get(id) as
    | Extension
    | undefined;
  if (!ext)
    return NextResponse.json({ error: "extension not found" }, { status: 404 });
  if (ext.role !== "mine")
    return NextResponse.json(
      { error: "Page ideas are only generated for your own (Mine) extension." },
      { status: 400 }
    );

  // Cached insights for grounding (may be absent → fallback path).
  const insRow = db
    .prepare("SELECT data FROM analyses WHERE project_id = ? AND kind = 'insights'")
    .get(ext.project_id) as { data: string } | undefined;
  const insights: InsightsResult | null = insRow ? JSON.parse(insRow.data) : null;

  const sampleReviews = db
    .prepare(
      "SELECT * FROM reviews WHERE extension_id = ? AND length(trim(body)) > 0 ORDER BY id DESC LIMIT 30"
    )
    .all(ext.id) as Review[];

  const result = await generatePageIdeas(
    {
      name: ext.name || ext.ext_id,
      category: ext.category || "",
      description: ext.description || "",
      users: ext.users || "",
      rating: ext.rating,
    },
    insights,
    sampleReviews
  );

  db.prepare(
    `INSERT INTO page_ideas (extension_id, project_id, data, grounded)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(extension_id) DO UPDATE SET
       data = excluded.data, grounded = excluded.grounded, created_at = datetime('now')`
  ).run(ext.id, ext.project_id, JSON.stringify(result.ideas), result.grounded ? 1 : 0);

  return NextResponse.json({ ...result, generated_at: new Date().toISOString() });
}
