// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error("Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);