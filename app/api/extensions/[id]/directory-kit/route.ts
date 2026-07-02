import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateDirectoryKit } from "@/lib/analysis";
import { scrapeWebsite } from "@/lib/scraper";
import type { Extension } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = getDb()
    .prepare("SELECT data, website, created_at FROM directory_kits WHERE extension_id = ?")
    .get(id) as { data: string; website: string; created_at: string } | undefined;
  if (!row) return NextResponse.json(null);
  return NextResponse.json({
    kit: JSON.parse(row.data),
    website: row.website,
    generated_at: row.created_at,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const websiteUrl: string = (body.website || "").trim();

  const db = getDb();
  const ext = db.prepare("SELECT * FROM extensions WHERE id = ?").get(id) as
    | Extension
    | undefined;
  if (!ext)
    return NextResponse.json({ error: "extension not found" }, { status: 404 });
  if (ext.role !== "mine")
    return NextResponse.json(
      { error: "Directory kits are only generated for your own (Mine) extension." },
      { status: 400 }
    );

  // Scrape the product website (landing + pricing) if a URL is given.
  let website = null;
  if (websiteUrl) {
    try {
      const w = await scrapeWebsite(websiteUrl);
      website = { url: w.url, title: w.title, metaDescription: w.metaDescription, text: w.text };
      db.prepare("UPDATE extensions SET website = ? WHERE id = ?").run(w.url, ext.id);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Could not load that website: ${e.message}` },
        { status: 400 }
      );
    }
  }

  const chromeWebStoreUrl = `https://chromewebstore.google.com/detail/${ext.slug ? ext.slug + "/" : ""}${ext.ext_id}`;

  const kit = await generateDirectoryKit(
    {
      name: ext.name || ext.ext_id,
      category: ext.category || "",
      chromeWebStoreUrl,
      rating: ext.rating,
      ratingCount: ext.rating_count,
      users: ext.users || "",
      storeDescription: ext.description || "",
    },
    website
  );

  db.prepare(
    `INSERT INTO directory_kits (extension_id, project_id, website, data)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(extension_id) DO UPDATE SET
       website = excluded.website, data = excluded.data, created_at = datetime('now')`
  ).run(ext.id, ext.project_id, websiteUrl, JSON.stringify(kit));

  return NextResponse.json({ kit, website: websiteUrl, generated_at: new Date().toISOString() });
}
