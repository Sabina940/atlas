import type { HandlerEvent } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY!;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").toLowerCase();

export async function requireAdmin(event: HandlerEvent) {
  const auth = event.headers.authorization || event.headers.Authorization;
  const token = auth?.toString().startsWith("Bearer ") ? auth.toString().slice(7) : null;
  if (!token) return { ok: false as const, status: 401, msg: "Missing bearer token" };

  // Use anon client + token to validate the user
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await authed.auth.getUser();
  if (error || !data?.user) return { ok: false as const, status: 401, msg: "Invalid session" };

  const email = (data.user.email || "").toLowerCase();
  if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) {
    return { ok: false as const, status: 403, msg: "Not allowed" };
  }

  return { ok: true as const, email, token };
}