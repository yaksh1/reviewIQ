import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const projects = db
    .prepare(
      `SELECT p.*,
        (SELECT COUNT(*) FROM extensions e WHERE e.project_id = p.id) AS ext_count,
        (SELECT COUNT(*) FROM reviews r JOIN extensions e ON e.id = r.extension_id WHERE e.project_id = p.id) AS review_count
       FROM projects p ORDER BY p.created_at DESC`
    )
    .all();
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { name, description } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "name required" }, { status: 400 });
  const db = getDb();
  const info = db
    .prepare("INSERT INTO projects (name, description) VALUES (?, ?)")
    .run(name.trim(), description?.trim() || "");
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(info.lastInsertRowid);
  return NextResponse.json(project);
}
