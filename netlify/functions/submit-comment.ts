import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

    const body = JSON.parse(event.body || "{}");
    const { post_id, author_name, author_email, body: text, parent_id } = body;

    if (!post_id || !author_name || !text) return { statusCode: 400, body: "Missing fields" };

    const db = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await db.from("comments").insert({
      post_id,
      parent_id: parent_id || null,
      author_name,
      author_email: author_email || null,
      body: text,
      status: "pending",
      is_admin_reply: false,
    });

    if (error) throw error;

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};