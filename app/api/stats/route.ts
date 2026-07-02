import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const db = getDb();
  const count = (sql: string): number => (db.prepare(sql).get() as { c: number }).c;
  const projects = count("SELECT COUNT(*) c FROM projects");
  const extensions = count("SELECT COUNT(*) c FROM extensions");
  const reviews = count("SELECT COUNT(*) c FROM reviews");
  const analyses = count("SELECT COUNT(*) c FROM analyses");
  const replies = count("SELECT COUNT(*) c FROM review_replies");

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
