import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { role } = await req.json();
  const db = getDb();
  if (role && (role === "mine" || role === "competitor")) {
    db.prepare("UPDATE extensions SET role = ? WHERE id = ?").run(role, id);
  }
  return NextResponse.json(
    db.prepare("SELECT * FROM extensions WHERE id = ?").get(id)
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  getDb().prepare("DELETE FROM extensions WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
