import type { Handler } from "@netlify/functions";
import { supabaseService } from "../../src/lib/supabaseServer";
import { parseNote } from "../../src/lib/parseNote";

export const handler: Handler = async (event) => {
  try {
    const secret = event.headers["x-atlas-secret"];
    if (!secret || secret !== process.env.ATLAS_INGEST_SECRET) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    let raw = event.body || "";

    // If Shortcut sends JSON: { raw: "..." }
    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(raw);
        raw = String(parsed?.raw ?? "");
      } catch {
        // leave raw as-is
      }
    }
    const note = parseNote(raw);

    if (!note.slug) {
      return { statusCode: 400, body: "Missing Slug: ..." };
    }

    const db = supabaseService();

    // upsert by slug
    const { data, error } = await db
      .from("posts")
      .upsert(
        {
          title: note.title,
          slug: note.slug,
          content_md: note.content_md,
          tags: note.tags,
          cover_url: note.cover_url,
          status: "draft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
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