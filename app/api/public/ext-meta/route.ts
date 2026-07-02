import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getExtMeta, saveExtMeta, type ExtMeta } from "@/lib/settings";

export const runtime = "nodejs";

/** GET → 'mine' extensions with their editable public meta. */
export async function GET() {
  const exts = getDb()
    .prepare("SELECT DISTINCT ext_id, name, category FROM extensions WHERE role = 'mine'")
    .all() as { ext_id: string; name: string; category: string }[];
  const apps = exts.map((e) => ({
    ext_id: e.ext_id,
    name: e.name || e.ext_id,
    category: e.category,
    meta: getExtMeta(e.ext_id),
  }));
  return NextResponse.json({ apps });
}

/** POST → save meta for one ext_id. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { extId?: string } & Partial<ExtMeta>;
  if (!body.extId) return NextResponse.json({ error: "extId required" }, { status: 400 });
  const patch: Partial<ExtMeta> = {};
  for (const k of ["builtIn", "prompts", "price", "created"] as (keyof ExtMeta)[]) {
    if (k in body) patch[k] = (body[k] as string) ?? "";
  }
  const saved = saveExtMeta(body.extId, patch);
  return NextResponse.json({ ok: true, meta: saved });
}
