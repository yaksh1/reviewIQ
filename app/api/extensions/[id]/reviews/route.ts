import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const reviews = db
    .prepare(
      `SELECT r.*, rr.reply AS reply
       FROM reviews r
       LEFT JOIN review_replies rr ON rr.review_id = r.id
       WHERE r.extension_id = ?
       ORDER BY r.id DESC`
    )
    .all(id);
  return NextResponse.json(reviews);
}
