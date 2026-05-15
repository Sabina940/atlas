import type { Handler } from "@netlify/functions";
import { supabaseService } from "../../src/lib/supabaseServer";
import { parseNote } from "../../src/lib/parseNote";

const BUCKET = "post-images";

type ImageInput = {
  name?: string;
  data: string; // base64-encoded image
};

async function uploadImages(
  db: ReturnType<typeof supabaseService>,
  slug: string,
  images: ImageInput[]
): Promise<string[]> {
  const urls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img?.data) continue;

    try {
      const buffer = Buffer.from(img.data, "base64");
      const ext  = (img.name?.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const path = `${slug}/${Date.now()}-${i}.${ext || "jpg"}`;

      const { error } = await db.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: mime, upsert: true });

      if (error) {
        console.error(`Image ${i} upload error:`, error.message);
        continue;
      }

      const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path);
      if (urlData?.publicUrl) urls.push(urlData.publicUrl);
    } catch (e: any) {
      console.error(`Image ${i} unexpected error:`, e?.message);
    }
  }

  return urls;
}

export const handler: Handler = async (event) => {
  try {
    const secret = event.headers["x-atlas-secret"];
    if (!secret || secret !== process.env.ATLAS_INGEST_SECRET) {
      return { statusCode: 401, body: "Unauthorized" };
    }

    const contentType = event.headers["content-type"] || event.headers["Content-Type"] || "";
    let raw = event.body || "";
    let images: ImageInput[] = [];

    if (contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(raw);
        raw = String(parsed?.raw ?? "");
        if (Array.isArray(parsed?.images)) {
          images = parsed.images as ImageInput[];
        }
      } catch {
        // leave raw as-is
      }
    }

    const note = parseNote(raw);
    if (!note.slug) {
      return { statusCode: 400, body: "Missing Slug: in note headers" };
    }

    const db = supabaseService();

    // Upload any attached images
    let imageUrls: string[] = [];
    if (images.length > 0) {
      imageUrls = await uploadImages(db, note.slug, images);
    }

    // First uploaded image → cover photo (only if Cover: not set in the note)
    const cover_url = note.cover_url ?? (imageUrls[0] ?? null);

    // All uploaded images are also embedded in the post body
    let content_md = note.content_md;
    if (imageUrls.length > 0) {
      const imgBlock = imageUrls.map((url) => `![](${url})`).join("\n\n");
      content_md = content_md.trim() + "\n\n" + imgBlock;
    }

    const { data, error } = await db
      .from("posts")
      .upsert(
        {
          title:      note.title,
          slug:       note.slug,
          content_md,
          tags:       note.tags,
          cover_url,
          category:   note.category,
          rating:     note.rating,
          status:     "draft",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("id, slug")
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, post: data, images_uploaded: imageUrls.length }),
      headers: { "content-type": "application/json" },
    };
  } catch (e: any) {
    return { statusCode: 500, body: e?.message || "Server error" };
  }
};
