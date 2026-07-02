import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const projects = (db.prepare("SELECT COUNT(*) c FROM projects").get() as any).c;
  const extensions = (db.prepare("SELECT COUNT(*) c FROM extensions").get() as any).c;
  const reviews = (db.prepare("SELECT COUNT(*) c FROM reviews").get() as any).c;
  const analyses = (db.prepare("SELECT COUNT(*) c FROM analyses").get() as any).c;
  const replies = (db.prepare("SELECT COUNT(*) c FROM review_replies").get() as any).c;

  const recentProjects = db
    .prepare(
      `SELECT p.id, p.name,
        (SELECT COUNT(*) FROM extensions e WHERE e.project_id = p.id) AS ext_count,
        (SELECT COUNT(*) FROM reviews r JOIN extensions e ON e.id=r.extension_id WHERE e.project_id=p.id) AS review_count
       FROM projects p ORDER BY p.created_at DESC LIMIT 6`
    )
    .all();

  return NextResponse.json({
    projects,
    extensions,
    reviews,
    analyses: analyses + replies,
    replies,
    recentProjects,
  });
}
