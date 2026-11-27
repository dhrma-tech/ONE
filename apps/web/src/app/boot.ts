import { applySeed } from "@/seed/seed";
import { startSync } from "@/data/syncRunner";

let booted: Promise<void> | null = null;

/** One-time app start: seed content (idempotent), then background sync. */
export function boot(): Promise<void> {
  booted ??= (async () => {
    try {
      await applySeed();
    } catch (e) {
      console.error("[seed]", e);
    }
    startSync();
  })();
  return booted;
}
