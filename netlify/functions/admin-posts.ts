import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_auth";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export const handler: Handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return json(admin.status, { error: admin.msg });

    if (event.httpMethod === "GET") {
      const { data, error } = await db
        .from("posts")
        .select("id,title,slug,excerpt,cover_url,status,created_at,updated_at,published_at")
        .order("created_at", { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { posts: data ?? [] });
    }

    if (event.httpMethod === "POST") {
      const body = safeJson(event.body);
      const action = body?.action;

      if (action === "upsert") {
        const post = body.post;
        const { data, error } = await db
          .from("posts")
          .upsert(post, { onConflict: "id" })
          .select()
          .single();

        if (error) return json(500, { error: error.message });
        return json(200, { post: data });
      }

      if (action === "delete") {
        const id = body?.id;
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
  try { return JSON.parse(s); } catch { return null; }
}