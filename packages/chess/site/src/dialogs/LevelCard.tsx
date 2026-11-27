// First-run level card (PLAN section 4): one question, dismissible, skippable. Skipping = "Know the moves".
import { py } from "../bridge/py";
import { settings, store } from "../bridge/storage";
import type { Level } from "../bridge/types";
import { today } from "../lib/chess";

export const LEVELS: { id: Level; label: string; sub: string }[] = [
  { id: "never", label: "Never played", sub: "Start from how the pieces move" },
  { id: "moves", label: "Know the moves", sub: "Rules yes, plans not yet" },
  { id: "basic", label: "Know basic strategy", sub: "Openings and simple tactics" },
  { id: "casual", label: "Casual", sub: "About 800 to 1200" },
  { id: "club", label: "Club", sub: "1200 and up" },
];

export async function ensureProfile(level: Level = "moves") {
  const p = await store.getProfile();
  if (p) return p;
  const np = await py.new_profile(level, null, today());
  await store.setProfile(np);
  return np;
}

export function LevelCard({ onDone }: { onDone: () => void }) {
  const pick = async (level: Level) => {
    const p = await py.new_profile(level, null, today());
    await store.setProfile(p);
    settings.set({ levelCardDismissed: true });
    onDone();
  };
  return (
    <section className="levelcard" aria-labelledby="lvl-h">
      <button className="icon-btn levelcard-x" onClick={() => void pick("moves")} aria-label="Skip">×</button>
      <h2 id="lvl-h">What's your level?</h2>
      <p className="muted small">Bobby uses this to pick a starting strength. You can skip it.</p>
      <div className="levels">
        {LEVELS.map((l) => (
          <button key={l.id} className="level" onClick={() => void pick(l.id)}>
            <strong>{l.label}</strong><small>{l.sub}</small>
          </button>
        ))}
      </div>
      <button className="textlink" onClick={() => void pick("moves")}>Skip</button>
    </section>
  );
}
