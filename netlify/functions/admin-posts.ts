import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_auth";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type PostStatus = "draft" | "published";

type PostInput = {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_url?: string | null;
  tags?: string[] | string; // allow "a,b,c" from UI
  status?: PostStatus;
  content_md?: string | null;
  published_at?: string | null;
};

export const handler: Handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return json(admin.status, { error: admin.msg });

    // ---------- GET: list OR single ----------
    if (event.httpMethod === "GET") {
      const id = event.queryStringParameters?.id;

      if (id) {
        const { data, error } = await db
          .from("posts")
          .select(
            "id,title,slug,excerpt,cover_url,tags,status,content_md,created_at,updated_at,published_at"
          )
          .eq("id", id)
          .single();

        if (error) return json(500, { error: error.message });
        return json(200, { post: data });
      }

      const { data, error } = await db
        .from("posts")
        .select("id,title,slug,excerpt,cover_url,tags,status,created_at,updated_at,published_at")
        .order("created_at", { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { posts: data ?? [] });
    }

    // ---------- PUT: upsert/save ----------
    // Body: { post: {...} }
    if (event.httpMethod === "PUT") {
      const body = safeJson(event.body);
      const post: PostInput | null = body?.post ?? null;
      if (!post) return json(400, { error: "Missing post" });

      const title = String(post.title ?? "").trim();
      const slug = String(post.slug ?? "").trim();
      if (!title || !slug) return json(400, { error: "Post needs title + slug" });

      const status = (post.status ?? "draft") as PostStatus;
      if (!["draft", "published"].includes(status)) return json(400, { error: "Invalid status" });

      const tags =
        Array.isArray(post.tags)
          ? post.tags.map((t) => String(t).trim()).filter(Boolean)
          : typeof post.tags === "string"
          ? post.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [];

      const published_at =
        status === "published"
          ? (post.published_at ?? new Date().toISOString())
          : null;

      const clean = {
        id: post.id ?? undefined,
        title,
        slug,
        excerpt: post.excerpt ?? null,
        cover_url: post.cover_url ?? null,
        tags,
        status,
        content_md: post.content_md ?? "",
        updated_at: new Date().toISOString(),
        published_at,
      };

      const { data, error } = await db
        .from("posts")
        .upsert(clean, { onConflict: "slug" })
        .select(
          "id,title,slug,excerpt,cover_url,tags,status,content_md,created_at,updated_at,published_at"
        )
        .single();

      if (error) return json(500, { error: error.message });
      return json(200, { post: data });
    }

    // ---------- DELETE: delete ----------
    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id;
      if (!id) return json(400, { error: "Missing id" });

      const { error } = await db.from("posts").delete().eq("id", id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    // ---------- OPTIONAL: keep POST actions (no recursion) ----------
    if (event.httpMethod === "POST") {
      const body = safeJson(event.body);
      const action = body?.action;

      if (action === "upsert") {
        const post: PostInput | null = body?.post ?? null;
        if (!post) return json(400, { error: "Missing post" });

        // run same normalization as PUT (inline)
        const title = String(post.title ?? "").trim();
        const slug = String(post.slug ?? "").trim();
        if (!title || !slug) return json(400, { error: "Post needs title + slug" });

        const status = (post.status ?? "draft") as PostStatus;
        if (!["draft", "published"].includes(status)) return json(400, { error: "Invalid status" });

        const tags =
          Array.isArray(post.tags)
            ? post.tags.map((t) => String(t).trim()).filter(Boolean)
            : typeof post.tags === "string"
            ? post.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [];

        const published_at =
          status === "published"
            ? (post.published_at ?? new Date().toISOString())
            : null;

        const clean = {
          id: post.id ?? undefined,
          title,
          slug,
          excerpt: post.excerpt ?? null,
          cover_url: post.cover_url ?? null,
          tags,
          status,
          content_md: post.content_md ?? "",
          updated_at: new Date().toISOString(),
          published_at,
        };

        const { data, error } = await db
          .from("posts")
          .upsert(clean, { onConflict: "slug" })
          .select(
            "id,title,slug,excerpt,cover_url,tags,status,content_md,created_at,updated_at,published_at"
          )
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

      if (action === "setStatus") {
        const id = String(body?.id || "");
        const status = body?.status as PostStatus;
        if (!id) return json(400, { error: "Missing id" });
        if (!["draft", "published"].includes(status)) return json(400, { error: "Invalid status" });

        const update: any = {
          status,
          updated_at: new Date().toISOString(),
          published_at: status === "published" ? new Date().toISOString() : null,
        };

        const { error } = await db.from("posts").update(update).eq("id", id);
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