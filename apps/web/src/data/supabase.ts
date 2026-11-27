import { createClient, type SupabaseClient, type Session } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { env, LOCAL_MODE } from "@/env";
import { setRepoUser } from "./repo";

export const supabase: SupabaseClient | null = LOCAL_MODE
  ? null
  : createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });

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

if (supabase) {
  supabase.auth.getSession().then(({ data }) => set(data.session));
  supabase.auth.onAuthStateChange((_e, s) => set(s));
}

export const auth = {
  get: () => state,
  async signIn(email: string, firstTime: boolean): Promise<string | null> {
    if (!supabase) return "Local mode: no login needed.";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback`, shouldCreateUser: firstTime },
    });
    return error ? error.message : null;
  },
  async signOut() {
    await supabase?.auth.signOut();
  },
  /** Bearer token for /api calls (empty in local mode). */
  async token(): Promise<string> {
    if (!supabase) return "";
    const { data } = await supabase.auth.getSession();
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
