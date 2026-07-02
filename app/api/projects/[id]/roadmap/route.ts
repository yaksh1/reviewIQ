import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateRoadmap } from "@/lib/analysis";
import type { Extension, Review } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

function loadReviews(db: ReturnType<typeof getDb>, extId: number): Review[] {
  return db
    .prepare(
      "SELECT * FROM reviews WHERE extension_id = ? AND length(trim(body)) > 0 ORDER BY id DESC"
    )
    .all(extId) as Review[];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cached = getDb()
    .prepare("SELECT data, created_at FROM analyses WHERE project_id = ? AND kind = 'roadmap'")
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

  const myReviews = loadReviews(db, mine.id);
  if (!myReviews.length)
    return NextResponse.json({ error: "Fetch reviews first." }, { status: 400 });

  const competitorReviews = comps.map((c) => ({
    name: c.name || c.ext_id,
    reviews: loadReviews(db, c.id),
  }));

  const roadmap = await generateRoadmap(
    mine.name || "our extension",
    myReviews,
    competitorReviews
  );

  db.prepare(
    `INSERT INTO analyses (project_id, kind, data) VALUES (?, 'roadmap', ?)
     ON CONFLICT(project_id, kind) DO UPDATE SET data = excluded.data, created_at = datetime('now')`
  ).run(id, JSON.stringify(roadmap));

  return NextResponse.json(roadmap);
}
