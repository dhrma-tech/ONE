import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Play } from "./pages/Play";
import { Review } from "./pages/Review";
import { Learn } from "./pages/Learn";
import { Train } from "./pages/Train";
import { Stats } from "./pages/Stats";
import { Palette } from "./components/Palette";
import { SearchBar } from "./components/SearchBar";
import { Toaster } from "./components/Toast";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { Dialog } from "./dialogs/Dialog";
import { go, useRoute } from "./lib/router";
import { commands, type Cmd } from "./lib/commands";
import { useSettings } from "./lib/useSettings";
import { settings, store } from "./bridge/storage";
import { useBridgeStatus } from "./bridge/py";

// Scroll (the video library; code and data still live under "cubicle") is lazy-loaded so its code and catalogue never weigh on the main bundle.
const Cubicle = lazy(() => import("./cubicle/Cubicle"));
type CubicleSection = { id: string; title: string };
let cubicleSections: Promise<CubicleSection[]> | null = null;
const loadCubicleSections = () => (cubicleSections ??= fetch(new URL("data/cubicle/taxonomy.json", document.baseURI))
  .then((r) => (r.ok ? r.json() : { sections: [] })).then((t: { sections?: CubicleSection[] }) => t.sections ?? []).catch(() => []));

const NAV: [string, string, string][] = [["Play", "/", ""], ["Learn", "/learn", "learn"], ["Train", "/train", "train"], ["Stats", "/stats", "stats"], ["Scroll", "/scroll", "scroll"]];
const SHORTCUTS: [string, string][] = [
  ["Ctrl/Cmd + K", "Command palette"], ["/", "Search"], ["?", "Show shortcuts"], ["g then p / l / t / s / v", "Go to Play, Learn, Train, Stats, Scroll (videos)"],
  ["← / →", "Step through moves"], ["F", "Flip board"], ["H", "Hint (press again for more)"], ["U", "Take back"], ["N", "New game"], [",", "Settings"],
  ["Scroll: j / k, Enter", "Move through videos, open one"], ["Scroll: s / d / q", "Save, mark done, queue"],
  ["Scroll: f / n", "Focus mode, note at the current time"],
];

const Gear = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
);

export default function App() {
  const route = useRoute();
  const s = useSettings();
  const bs = useBridgeStatus();
  const [pal, setPal] = useState(false);
  const [set, setSet] = useState(false);
  const [help, setHelp] = useState(false);

  // The video section was renamed from Cubicle to Scroll: send old links to the new route.
  useEffect(() => { if (location.hash.startsWith("#/cubicle")) location.replace(location.hash.replace("#/cubicle", "#/scroll")); }, [route]);

  useEffect(() => {
    if (s.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", s.theme);
  }, [s.theme]);

  useEffect(() => {
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((p) => !p); return; }
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) { if (e.key === "Escape") t.blur(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".dialog-wrap")) return;
      if (g) {
        g = false;
        const m: Record<string, string> = { p: "/", l: "/learn", t: "/train", s: "/stats", v: "/scroll" };
        if (m[e.key]) { go(m[e.key]); e.preventDefault(); return; }
      }
      if (e.key === "g") { g = true; setTimeout(() => { g = false; }, 900); }
      else if (e.key === "?") setHelp((h) => !h);
      else if (e.key === ",") setSet(true);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // App-level commands, shared by the palette and the top search bar (page commands are added from the registry).
  const base = useMemo<Cmd[]>(() => {
    const last = async () => { const gs = await store.listGames(); if (gs[0]) go(`/review/${gs[0].id}`); };
    const cubicleFocus = async () => { const m = await import("./cubicle/store"); await m.loadCubicleState(); m.cubicle.setPrefs({ focus: !m.getCubicle().prefs.focus }); };
    return [
      { id: "cubicle", label: "Open Scroll (chess videos)", hint: "Page", keys: "g v", run: () => go("/scroll") },
      { id: "cubicle-search", label: "Search videos in Scroll", hint: "Scroll", run: () => { go("/scroll"); setTimeout(() => (document.querySelector('[data-testid="cubicle-search"]') as HTMLInputElement | null)?.focus(), 300); } },
      { id: "cubicle-focus", label: "Scroll: toggle focus mode", hint: "Scroll", run: () => void cubicleFocus() },
      ...NAV.map(([l, h]) => ({ id: "p:" + h, label: l, hint: "Page", run: () => go(h) })),
      { id: "review-last", label: "Review last game", hint: "Page", run: () => void last() },
      { id: "settings", label: "Settings", hint: "Dialog", keys: ",", run: () => setSet(true) },
      { id: "data", label: "Export or import data", hint: "Dialog", run: () => setSet(true) },
      { id: "t-light", label: "Theme: light", hint: "Action", run: () => settings.set({ theme: "light" }) },
      { id: "t-dark", label: "Theme: dark", hint: "Action", run: () => settings.set({ theme: "dark" }) },
      { id: "t-auto", label: "Theme: match system", hint: "Action", run: () => settings.set({ theme: "auto" }) },
      { id: "sounds", label: s.sounds ? "Sounds: off" : "Sounds: on", hint: "Action", run: () => settings.set({ sounds: !s.sounds }) },
      ...([["puzzles", "Puzzles"], ["endgames", "Endgames"], ["openings", "Openings explorer"], ["tricks", "Tricks library"], ["challenges", "Daily plan and challenges"]] as const).map(([t, l]) => ({ id: "tr:" + t, label: l, hint: "Train", run: () => go(`/train?tab=${t}`) })),
      { id: "voice", label: s.voice.enabled ? "Voice: off" : "Voice: on", hint: "Action", run: () => settings.set({ voice: { ...s.voice, enabled: !s.voice.enabled } }) },
      { id: "help", label: "Keyboard shortcuts", hint: "Help", keys: "?", run: () => setHelp(true) },
    ];
  }, [s.sounds, s.voice]);
  const [secCmds, setSecCmds] = useState<Cmd[]>([]);
  useEffect(() => {
    if (!pal || secCmds.length) return;
    void loadCubicleSections().then((ss) => setSecCmds(ss.map((x) => ({ id: "cb-s:" + x.id, label: `Scroll: ${x.title}`, hint: "Videos", run: () => go(`/scroll?s=${x.id}`) }))));
  }, [pal, secCmds.length]);
  const cmds = useMemo<Cmd[]>(() => (pal ? [...commands.get(), ...base, ...secCmds] : []), [pal, base, secCmds]);

  const [p0, p1] = route.path;
  const page = p0 === "review" && p1 ? <Review id={p1} key={p1} />
    : p0 === "learn" ? <Learn /> : p0 === "train" ? <Train /> : p0 === "stats" ? <Stats />
    : p0 === "scroll" ? <Suspense fallback={<div className="loading">Loading Scroll…</div>}><Cubicle /></Suspense>
    : <Play />;
  const active = p0 === "review" ? "" : p0 ?? "";

  return (
    <div className="shell">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <header className="top">
        <a className="brand" href="#/" aria-label="Bobby home"><span className="brand-mark" aria-hidden="true"><img src="./coach-knight-96.png" alt="" width="30" height="30" draggable={false} /></span>Bobby</a>
        <div className="top-c">
          <nav className="topnav" aria-label="Main">
            {NAV.map(([l, h, k]) => <a key={h} href={"#" + h} className={"tn" + (active === k ? " on" : "")} aria-current={active === k ? "page" : undefined}>{l}</a>)}
          </nav>
          <SearchBar base={base} />
        </div>
        <div className="top-r">
          {bs.mode === "loading" ? <span className="pill" title="Loading the Python core in the background">Loading core…</span> : null}
          {bs.mode === "fallback" ? <span className="pill warn" title={bs.error ?? "Python core unavailable; using dev fallback"}>Dev fallback</span> : null}
          <button className="kbtn" onClick={() => setPal(true)} aria-label="Command palette"><kbd>⌘K</kbd></button>
          <button className="icon-btn" onClick={() => setSet(true)} aria-label="Settings"><Gear /></button>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{page}</main>
      {pal ? <Palette cmds={cmds} onClose={() => setPal(false)} /> : null}
      {set ? <SettingsDialog onClose={() => setSet(false)} /> : null}
      {help ? (
        <Dialog title="Keyboard shortcuts" onClose={() => setHelp(false)}>
          <dl className="keys-dl">{SHORTCUTS.map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
        </Dialog>
      ) : null}
      <Toaster />
    </div>
  );
}
