// Client environment. Only VITE_* variables reach the browser bundle.
const e = import.meta.env;
export const env = {
  supabaseUrl: (e.VITE_SUPABASE_URL as string | undefined)?.trim() || "",
  supabaseAnonKey: (e.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "",
  version: "0.1.0",
};
/** Local mode = no Supabase configured: everything stays in IndexedDB, no login. */
export const LOCAL_MODE = !env.supabaseUrl || !env.supabaseAnonKey;
