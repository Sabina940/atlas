import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_auth";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type PostStatus = "draft" | "published";

export const handler: Handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return json(admin.status, { error: admin.msg });

    // ---------- GET: list posts ----------
    if (event.httpMethod === "GET") {
      const { data, error } = await db
        .from("posts")
        .select("id,title,slug,excerpt,cover_url,tags,status,content_md,created_at,updated_at,published_at")
        .order("created_at", { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { posts: data ?? [] });
    }

    // ---------- POST: upsert / delete ----------
    if (event.httpMethod === "POST") {
      const body = safeJson(event.body);
      const action = body?.action;

      if (action === "upsert") {
        const post = body?.post ?? null;
        if (!post) return json(400, { error: "Missing post" });

        // normalize
        const status = (post.status ?? "draft") as PostStatus;
        if (!["draft", "published"].includes(status)) {
          return json(400, { error: "Invalid status" });
        }

        // If publishing now and no published_at, set it
        if (status === "published" && !post.published_at) {
          post.published_at = new Date().toISOString();
        }
        if (status === "draft") {
          // optional: if draft, clear published_at
          // post.published_at = null;
        }

        // ensure required fields exist
        if (!post.title || !post.slug) return json(400, { error: "Post needs title + slug" });

        // default optional fields
        post.content_md = post.content_md ?? "";
        post.tags = post.tags ?? [];

        const { data, error } = await db
          .from("posts")
          .upsert(post, { onConflict: "slug" }) // <— slug is unique in your schema
          .select()
          .single();

        if (error) return json(500, { error: error.message });
        return json(200, { post: data });
      }

      if (action === "delete") {
        const id = String(body?.id || "");
        if (!id) return json(400, { error: "Missing id" });

        const { error } = await db.from("posts").delete().eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { ok: true });
      }

      return json(400, { error: "Unknown action" });
    }

    return json(405, { error: "Method not allowed" });
  } catch (e: any) {
    return json(500, { error: e?.message || "Unknown error" });
  }
};

function json(statusCode: number, data: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

function safeJson(s?: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}