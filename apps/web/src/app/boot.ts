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
    // Background chores after first paint: derived public stats, daily calendar re-sync, saved appearance.
    setTimeout(() => {
      void import("@/services/derived").then((m) => m.refreshDerivedStats()).catch(() => undefined);
      void import("@/services/calendarPush").then((m) => m.pushCalendarDaily()).catch(() => undefined);
      void import("@/services/settings").then(async (m) => {
        const s = await m.getSettings();
        if (s?.font_scale && s.font_scale !== 1) document.documentElement.style.setProperty("--font-scale", String(s.font_scale));
        for (const [k, v] of Object.entries((s?.accents ?? {}) as Record<string, string>)) document.documentElement.style.setProperty(`--accent-${k}`, v);
      });
    }, 1500);
  })();
  return booted;
}
