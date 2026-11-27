// Supabase client, loaded lazily (dynamic import) so first paint and local mode don't pay for the SDK.
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { env, LOCAL_MODE } from "@/env";
import { setRepoUser } from "./repo";

interface AuthState {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
}

let state: AuthState = { ready: LOCAL_MODE, session: null, userId: null, email: null };
const subs = new Set<() => void>();
const set = (s: Session | null) => {
  state = { ready: true, session: s, userId: s?.user.id ?? null, email: s?.user.email ?? null };
  setRepoUser(state.userId);
  subs.forEach((f) => f());
};

let loading: Promise<SupabaseClient | null> | null = null;

/** The Supabase client, or null in local mode. Created once, on first use. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (LOCAL_MODE) return Promise.resolve(null);
  loading ??= import("@supabase/supabase-js").then(({ createClient }) => {
    const c = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
    void c.auth.getSession().then(({ data }) => set(data.session));
    c.auth.onAuthStateChange((_e, s) => set(s));
    return c;
  });
  return loading;
}

if (!LOCAL_MODE && typeof window !== "undefined") void getSupabase();

export const auth = {
  get: () => state,
  async signIn(email: string, firstTime: boolean): Promise<string | null> {
    const sb = await getSupabase();
    if (!sb) return "Local mode: no login needed.";
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: firstTime },
    });
    return error ? error.message : null;
  },
  async signOut() {
    await (await getSupabase())?.auth.signOut();
  },
  /** Bearer token for /api calls (empty in local mode). */
  async token(): Promise<string> {
    const sb = await getSupabase();
    if (!sb) return "";
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? "";
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );
}
