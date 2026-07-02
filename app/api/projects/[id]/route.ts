import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  const extensions = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM reviews r WHERE r.extension_id = e.id) AS review_count
       FROM extensions e WHERE e.project_id = ? ORDER BY e.role = 'mine' DESC, e.created_at ASC`
    )
    .all(id);
  return NextResponse.json({ project, extensions });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  if (body.months_back != null) {
    const m = Math.max(1, Math.min(120, Math.round(Number(body.months_back))));
    db.prepare("UPDATE projects SET months_back = ? WHERE id = ?").run(m, id);
  }
  if (typeof body.name === "string" && body.name.trim()) {
    db.prepare("UPDATE projects SET name = ? WHERE id = ?").run(body.name.trim(), id);
  }
  return NextResponse.json(db.prepare("SELECT * FROM projects WHERE id = ?").get(id));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
