import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateReplies } from "@/lib/analysis";
import type { Extension, Review } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

/** Generate AI reply drafts for all reviews of the project's "mine" extension. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const mine = db
    .prepare("SELECT * FROM extensions WHERE project_id = ? AND role = 'mine'")
    .get(id) as Extension | undefined;
  if (!mine)
    return NextResponse.json(
      { error: "No extension is assigned as 'mine' in this project." },
      { status: 400 }
    );

  const reviews = db
    .prepare(
      "SELECT * FROM reviews WHERE extension_id = ? AND length(trim(body)) > 0 ORDER BY id DESC LIMIT 60"
    )
    .all(mine.id) as Review[];
  if (!reviews.length)
    return NextResponse.json(
      { error: "No reviews to reply to. Fetch reviews first." },
      { status: 400 }
    );

  const replies = await generateReplies(
    mine.name || "our extension",
    reviews.map((r) => ({ body: r.body, rating: r.rating, author: r.author }))
  );

  const upsert = db.prepare(
    `INSERT INTO review_replies (review_id, reply) VALUES (?, ?)
     ON CONFLICT(review_id) DO UPDATE SET reply = excluded.reply, created_at = datetime('now')`
  );
  const tx = db.transaction(() => {
    for (const r of replies) {
      const review = reviews[r.index];
      if (review) upsert.run(review.id, r.reply);
    }
  });
  tx();

  return NextResponse.json({ count: replies.length, extension_id: mine.id });
}
