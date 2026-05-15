import type { Handler } from "@netlify/functions";
import { supabaseService } from "../../src/lib/supabaseServer";
import { parseNote } from "../../src/lib/parseNote";

function extractGalleryBlock(md: string): string {
  const div = md.match(/\n\n<div class="gallery">[\s\S]*?<\/div>\s*$/);
  if (div) return div[0];
  const single = md.match(/\n\n!\[\]\([^)]+\)\s*$/);
  if (single) return single[0];
  return "";
}

export const handler: Handler = async (event) => {
  try {
    const secret = event.headers["x-atlas-secret"];
    if (!secret || secret !== process.env.ATLAS_INGEST_SECRET) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    let raw = event.body || "";

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(raw);
        raw = String(parsed?.raw ?? parsed ?? "");
      } catch {
        // leave raw as-is
      }
    }

    const note = parseNote(raw);
    if (!note.slug) {
      return { statusCode: 400, body: "Missing Slug: in note headers" };
    }

    const db = supabaseService();

    // Preserve any gallery block already added via admin upload
    const { data: existing } = await db
      .from("posts")
      .select("content_md, cover_url")
      .eq("slug", note.slug)
      .maybeSingle();

    const galleryBlock = extractGalleryBlock(existing?.content_md ?? "");
    const content_md = note.content_md.trim() + galleryBlock;
    const cover_url = note.cover_url ?? existing?.cover_url ?? null;

    const upsertData: Record<string, unknown> = {
      title:      note.title,
      slug:       note.slug,
      content_md,
      excerpt:    note.excerpt,
      tags:       note.tags,
      category:   note.category,
      rating:     note.rating,
      cover_url,
      status:     "draft",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("posts")
      .upsert(upsertData, { onConflict: "slug" })
      .select("id, slug")
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, post: data }),
      headers: { "content-type": "application/json" },
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};
