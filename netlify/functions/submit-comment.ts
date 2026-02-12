import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

function json(statusCode: number, data: any) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export const handler: Handler = async (event) => {
  try {
    const db = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.PUBLIC_SUPABASE_ANON_KEY!
    );

    // -------- GET: approved comments for a post --------
    if (event.httpMethod === "GET") {
      const post_id = event.queryStringParameters?.post_id;
      if (!post_id) return json(400, { error: "Missing post_id" });

      const { data, error } = await db
        .from("comments")
        .select("id, post_id, parent_id, author_name, body, is_admin_reply, created_at")
        .eq("post_id", post_id)
        .eq("status", "approved")
        .order("created_at", { ascending: true });

      if (error) return json(500, { error: error.message });
      return json(200, { comments: data ?? [] });
    }

    // -------- POST: create pending comment --------
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { post_id, author_name, author_email, body: text, parent_id } = body;

      if (!post_id || !author_name || !text) return json(400, { error: "Missing fields" });

      const { error } = await db.from("comments").insert({
        post_id,
        parent_id: parent_id || null,
        author_name,
        author_email: author_email || null,
        body: text,
        status: "pending",
        is_admin_reply: false,
      });

      if (error) return json(500, { error: error.message });
      return json(200, { ok: true });
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (e: any) {
    return json(500, { error: e?.message || "Server error" });
  }
};