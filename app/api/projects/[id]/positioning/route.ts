import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generatePositioning } from "@/lib/analysis";
import type { Extension, Review } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cached = getDb()
    .prepare("SELECT data, created_at FROM analyses WHERE project_id = ? AND kind = 'positioning'")
    .get(id) as { data: string; created_at: string } | undefined;
  if (!cached) return NextResponse.json(null);
  return NextResponse.json({ ...JSON.parse(cached.data), generated_at: cached.created_at });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const exts = db
    .prepare("SELECT * FROM extensions WHERE project_id = ?")
    .all(id) as Extension[];
  const mine = exts.find((e) => e.role === "mine");
  const comps = exts.filter((e) => e.role === "competitor");
  if (!mine)
    return NextResponse.json({ error: "Assign a 'mine' extension first." }, { status: 400 });
  if (!comps.length)
    return NextResponse.json({ error: "Add at least one competitor." }, { status: 400 });

  const competitorReviews = comps.map((c) => ({
    name: c.name || c.ext_id,
    reviews: db
      .prepare("SELECT * FROM reviews WHERE extension_id = ? AND length(trim(body)) > 0")
      .all(c.id) as Review[],
  }));
  if (!competitorReviews.some((c) => c.reviews.length))
    return NextResponse.json({ error: "Fetch competitor reviews first." }, { status: 400 });

  const positioning = await generatePositioning(
    mine.name || "our extension",
    competitorReviews
  );

  db.prepare(
    `INSERT INTO analyses (project_id, kind, data) VALUES (?, 'positioning', ?)
     ON CONFLICT(project_id, kind) DO UPDATE SET data = excluded.data, created_at = datetime('now')`
  ).run(id, JSON.stringify(positioning));

  return NextResponse.json(positioning);
}
