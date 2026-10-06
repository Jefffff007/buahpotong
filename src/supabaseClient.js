import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diisi. " +
      "Salin .env.example ke .env (lokal) atau isi Environment Variables di Vercel."
  );
}

export const supabase = createClient(url, key);
export const hasSupabaseConfig = Boolean(url && key);
