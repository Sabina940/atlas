import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_auth";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type CommentStatus = "pending" | "approved" | "spam" | "deleted";

export const handler: Handler = async (event) => {
  try {
    const admin = await requireAdmin(event);
    if (!admin.ok) return json(admin.status, { error: admin.msg });

    // ---------- GET: list comments by status ----------
    if (event.httpMethod === "GET") {
      const status = (event.queryStringParameters?.status ?? "pending") as CommentStatus;

      const { data, error } = await db
        .from("comments")
        .select(
          `
          id,
          post_id,
          parent_id,
          author_name,
          author_email,
          body,
          status,
          is_admin_reply,
          created_at,
          posts:post_id ( id, title, slug )
        `
        )
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) return json(500, { error: error.message });
      return json(200, { comments: data ?? [] });
    }

    // ---------- POST: moderate / reply ----------
    if (event.httpMethod === "POST") {
      const body = safeJson(event.body);
      const action = body?.action;

      // Change status (approve/spam/delete)
      if (action === "setStatus") {
        const id = String(body?.id || "");
        const status = body?.status as CommentStatus;

        if (!id) return json(400, { error: "Missing id" });
        if (!["pending", "approved", "spam", "deleted"].includes(status))
          return json(400, { error: "Invalid status" });

        const { error } = await db.from("comments").update({ status }).eq("id", id);
        if (error) return json(500, { error: error.message });
        return json(200, { ok: true });
      }

      // Reply = INSERT a new comment row (child)
      if (action === "reply") {
          const parentId = String(body?.id || "");
          const reply = String(body?.reply || "");

          if (!parentId || !reply.trim()) return json(400, { error: "Missing id/reply" });

          // Get the parent comment to copy its post_id
          const { data: parent, error: parentErr } = await db
            .from("comments")
            .select("id, post_id")
            .eq("id", parentId)
            .single();

          if (parentErr || !parent) return json(404, { error: "Parent comment not found" });

          const { error: insErr } = await db.from("comments").insert({
            post_id: parent.post_id,
            parent_id: parent.id,
            author_name: "Admin",
            author_email: null,
            body: reply,
            status: "approved",
            is_admin_reply: true,
          });

          if (insErr) return json(500, { error: insErr.message });
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