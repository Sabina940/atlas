import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "./_auth";

const BUCKET = "post-images";
const db = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const auth = await requireAdmin(event);
  if (!auth.ok) return { statusCode: auth.status, body: auth.msg };

  try {
    const { slug, filename, data, mime } = JSON.parse(event.body || "{}");

    if (!slug || !data) {
      return { statusCode: 400, body: "Missing slug or image data" };
    }

    const buffer = Buffer.from(data, "base64");
    const ext = ((filename as string | undefined)?.split(".").pop() ?? "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";
    const contentType =
      mime ||
      (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
    const path = `${slug}/${Date.now()}.${ext}`;

    const { error } = await db.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw error;

    const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path);

    return {
      statusCode: 200,
      body: JSON.stringify({ url: urlData.publicUrl }),
      headers: { "content-type": "application/json" },
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Upload failed" };
  }
};
