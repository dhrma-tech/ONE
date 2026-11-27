// ONE integration bridge (added for ONE; not part of upstream BOBBY).
// When Bobby runs inside ONE's /mind/chess iframe it:
//  - takes the theme from ONE (?theme=dark|light) so it matches the app,
//  - reports activity (game finished, puzzle attempted, lesson completed) to the parent window,
//  - accepts { type: "one:review-pgn", pgn } to import a Chess.com game and open it in Review.
import { db, settings, store } from "./bridge/storage";

const embedded = typeof window !== "undefined" && window.parent !== window;
const params = new URLSearchParams(location.search);

if (embedded) {
  document.documentElement.classList.add("in-one");
  const theme = params.get("theme");
  if (theme === "dark" || theme === "light") {
    // Settings were already loaded when storage.ts evaluated, so set them through Bobby's own store.
    if (settings.get().theme !== theme) settings.set({ theme });
    document.documentElement.setAttribute("data-theme", theme);
  }
}

type OneEvent = { type: "one:chess-event"; kind: "game_finished" | "puzzle_attempt" | "lesson_done"; detail: Record<string, unknown> };
const post = (e: OneEvent) => {
  if (!embedded) return;
  try {
    window.parent.postMessage(e, location.origin);
  } catch {
    /* parent gone */
  }
};

if (embedded) {
  db.games.hook("creating", (_pk, g) => {
    setTimeout(() => post({ type: "one:chess-event", kind: "game_finished", detail: { id: g.id, result: g.result, mode: g.mode, botRating: g.botRating } }), 0);
  });
  db.puzzleProgress.hook("updating", (mods, pk) => {
    setTimeout(() => post({ type: "one:chess-event", kind: "puzzle_attempt", detail: { id: pk, mods: Object.keys(mods as object) } }), 0);
  });
  db.lessonProgress.hook("updating", (mods, pk, prev) => {
    const m = mods as { done?: boolean };
    if (m.done && !(prev as { done?: boolean }).done) setTimeout(() => post({ type: "one:chess-event", kind: "lesson_done", detail: { id: pk } }), 0);
  });

  window.addEventListener("message", async (e: MessageEvent) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data as { type?: string; pgn?: string; url?: string; playerColor?: "w" | "b"; result?: "1-0" | "0-1" | "1/2-1/2" | "*" };
    if (d?.type !== "one:review-pgn" || typeof d.pgn !== "string" || d.pgn.length > 200_000) return;
    const id = "cc-" + (d.url ?? d.pgn).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
    const existing = await store.getGame(id);
    if (!existing) {
      const res = d.result ?? ((d.pgn.match(/\[Result "([^"]+)"\]/)?.[1] as "1-0" | "0-1" | "1/2-1/2" | undefined) ?? "*");
      await store.saveGame({
        id,
        pgn: d.pgn,
        result: res as never,
        mode: "local",
        playerColor: d.playerColor ?? "w",
        botRating: null,
        date: new Date().toISOString(),
        startFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        timeControl: "chess.com",
        termination: null,
        analysed: false,
      });
    }
    location.hash = `#/review/${id}`;
  });
  post({ type: "one:chess-event", kind: "game_finished", detail: { ready: true } } as OneEvent & { detail: { ready: true } });
}

export {};
