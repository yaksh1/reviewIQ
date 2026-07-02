import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/** Accepts a raw ext id or a full Chrome Web Store URL and extracts the id. */
function parseExtId(input: string): string | null {
  const s = input.trim();
  // 32-char lowercase id, possibly inside a URL.
  const m = s.match(/([a-p]{32})/);
  if (m) return m[1];
  // fallback: last path segment if it looks id-like
  const last = s.split(/[/?#]/).filter(Boolean).pop() || "";
  return /^[a-z0-9]{20,}$/i.test(last) ? last : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { input, role } = await req.json();
  const extId = parseExtId(input || "");
  if (!extId)
    return NextResponse.json(
      { error: "Could not parse an extension ID from that input." },
      { status: 400 }
    );

  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project)
    return NextResponse.json({ error: "project not found" }, { status: 404 });

  // Only one "mine" per project — demote others if this is mine.
  const finalRole = role === "mine" ? "mine" : "competitor";

  try {
    const info = db
      .prepare(
        "INSERT INTO extensions (project_id, ext_id, role) VALUES (?, ?, ?)"
      )
      .run(id, extId, finalRole);
    return NextResponse.json(
      db.prepare("SELECT * FROM extensions WHERE id = ?").get(info.lastInsertRowid)
    );
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE"))
      return NextResponse.json(
        { error: "That extension is already in this project." },
        { status: 409 }
      );
    throw e;
  }
}
