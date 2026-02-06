import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./_auth";

export const handler: Handler = async (event) => {
  const gate = await requireAdmin(event);
  if (!gate.ok) return { statusCode: gate.status, body: gate.msg };

  const { db } = gate;

  try {
    if (event.httpMethod === "GET") {
      const status = (event.queryStringParameters || {}).status || "pending";
      const { data, error } = await db
        .from("comments")
        .select("id,post_id,parent_id,author_name,author_email,body,status,is_admin_reply,created_at, posts(title,slug)")
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === "PUT") {
      const body = JSON.parse(event.body || "{}");
      const { id, status } = body;
      if (!id || !status) return json(400, { error: "id + status required" });

      const { data, error } = await db
        .from("comments")
        .update({ status })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === "POST") {
      // admin reply
      const body = JSON.parse(event.body || "{}");
      const { post_id, parent_id, body: text } = body;
      if (!post_id || !parent_id || !text) return json(400, { error: "post_id + parent_id + body required" });

      const { data, error } = await db
        .from("comments")
        .insert({
          post_id,
          parent_id,
          author_name: "Pierina",
          author_email: null,
          body: text,
          status: "approved",
          is_admin_reply: true,
        })
        .select("*")
        .single();

      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === "DELETE") {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return json(400, { error: "id query param required" });

      const { error } = await db.from("comments").delete().eq("id", id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return { statusCode: 405, body: "Method not allowed" };
  } catch (e: any) {
    return json(500, { error: e?.message || "Server error" });
  }
};

function json(statusCode: number, body: any) {
  return { statusCode, body: JSON.stringify(body), headers: { "content-type": "application/json" } };
}