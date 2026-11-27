// Wires the sync engine to Supabase and schedules it: on start, on reconnect, every 60 s while visible,
// and 1.5 s after local writes. No-op in local mode.
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, auth } from "./supabase";
import { LOCAL_MODE } from "@/env";
import { onLocalWrite } from "./repo";
import { syncOnce, type RemoteApi, type SyncResult } from "./sync";
import type { TableName } from "./schema";
import type { BaseRow } from "./types.gen";

export function supabaseRemote(client: SupabaseClient): RemoteApi {
  return {
    async upsert(table: TableName, rows: BaseRow[]) {
      const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    },
    async pullSince(table: TableName, since: string | null, limit: number) {
      let q = client.from(table).select("*").order("synced_at", { ascending: true }).limit(limit);
      if (since) q = q.gt("synced_at", since);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as BaseRow[];
    },
    async uploadBlob(bucket, path, blob, mime) {
      const { error } = await client.storage.from(bucket).upload(path, blob, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
    },
  };
}

interface SyncState {
  status: "local" | "idle" | "syncing" | "offline" | "error" | "signed-out";
  last?: SyncResult;
  lastAt?: string;
}
let state: SyncState = { status: LOCAL_MODE ? "local" : "signed-out" };
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
export const useSyncState = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => state,
  );

let running = false;
let again = false;
export async function syncNow(): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const uid = auth.get().userId;
  if (!uid) return set({ status: "signed-out" });
  if (typeof navigator !== "undefined" && !navigator.onLine) return set({ status: "offline" });
  if (running) {
    again = true;
    return;
  }
  running = true;
  set({ status: "syncing" });
  try {
    const r = await syncOnce(supabaseRemote(supabase), uid);
    set({ status: r.errors.length ? "error" : "idle", last: r, lastAt: new Date().toISOString() });
  } catch (e) {
    set({ status: "error", last: { pushed: 0, pulled: 0, conflicts: 0, errors: [String(e)] } });
  } finally {
    running = false;
    if (again) {
      again = false;
      void syncNow();
    }
  }
}

let started = false;
export function startSync() {
  if (started || LOCAL_MODE) return;
  started = true;
  let t: ReturnType<typeof setTimeout> | undefined;
  onLocalWrite(() => {
    clearTimeout(t);
    t = setTimeout(() => void syncNow(), 1500);
  });
  window.addEventListener("online", () => void syncNow());
  setInterval(() => {
    if (!document.hidden) void syncNow();
  }, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncNow();
  });
  void syncNow();
}
