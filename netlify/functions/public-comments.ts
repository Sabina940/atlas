import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  is_admin_reply: boolean;
  created_at: string;
};

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method not allowed" };

    const post_id = event.queryStringParameters?.post_id;
    if (!post_id) return { statusCode: 400, body: "Missing post_id" };

    const db = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    // Only show APPROVED comments publicly.
    const { data, error } = await db
      .from("comments")
      .select("id,post_id,parent_id,author_name,body,is_admin_reply,created_at")
      .eq("post_id", post_id)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as CommentRow[];
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: rows }),
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};