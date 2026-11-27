// Ctrl/⌘+K: go anywhere, run actions. Plus the "?" shortcut help sheet.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { describe, fuzzy, parseCommand, type Command } from "@/domain/command";
import { ui, useUI } from "@/data/ui";
import { repo } from "@/data/repo";
import { addTask } from "@/services/tasks";
import { bumpPersona, logDiet, logMeditation, logWater, logWeight } from "@/services/log";
import { focus } from "./focus";
import { Icon, Kbd, Sheet, toast } from "@/ui";
import { inScope } from "@/scope";

interface Item {
  id: string;
  label: string;
  kind: string;
  run: () => void | Promise<void>;
}

const ROUTES: [string, string][] = [
  ["Home", "/"],
  ["Career · Path", "/career/path"],
  ["Career · Library", "/career/library"],
  ["Career · Practice", "/career/practice"],
  ["Career · Build", "/career/build"],
  ["Career · News", "/career/news"],
  ["Career · Reading", "/career/reading"],
  ["Career · Notes", "/career/notes"],
  ["Career · College", "/career/college"],
  ["Career · Analytics", "/career/analytics"],
  ["Mind · Chess", "/mind/chess"],
  ["Mind · Meditate", "/mind/meditate"],
  ["Mind · Library", "/mind/library"],
  ["Mind · Focus", "/mind/focus"],
  ["Mind · Memory", "/mind/memory"],
  ["Mind · Reading", "/mind/reading"],
  ["Mind · Analytics", "/mind/analytics"],
  ["Body · Workout", "/body/workout"],
  ["Body · Schedule", "/body/schedule"],
  ["Body · Weigh-in", "/body/weigh-in"],
  ["Body · Diet", "/body/diet"],
  ["Body · Water", "/body/water"],
  ["Body · Progress", "/body/progress"],
  ["Body · Library", "/body/library"],
  ["Body · Analytics", "/body/analytics"],
  ["Persona · Speak", "/persona/speak"],
  ["Persona · Daily", "/persona/daily"],
  ["Persona · Connections", "/persona/connections"],
  ["Persona · Compose", "/persona/compose"],
  ["Persona · Ideas", "/persona/ideas"],
  ["Persona · X Follows", "/persona/x-follows"],
  ["Persona · Market Intel", "/persona/intel"],
  ["Persona · Presence", "/persona/presence"],
  ["Persona · Library", "/persona/library"],
  ["Persona · Analytics", "/persona/analytics"],
  ["Weekly review", "/review/week"],
  ["Settings", "/settings"],
  ["Settings · Integrations", "/settings/integrations"],
  ["Settings · Targets", "/settings/targets"],
  ["Settings · Data", "/settings/data"],
  ["Style guide", "/ui"],
];

export async function runCommand(c: Command, nav: (p: string) => void): Promise<void> {
  switch (c.kind) {
    case "water":
      await logWater(c.ml);
      return void toast.ok(`+${c.ml} ml. Hydrated.`);
    case "weight":
      await logWeight(c.kg);
      return void toast.ok(`${c.kg} kg logged.`);
    case "focus":
      focus.start({ plannedMin: c.minutes });
      return void toast.ok(`Focus ${c.minutes} min. Phone in the other room.`);
    case "task":
      await addTask(c.title, c.section, undefined, c.oneThing);
      return void toast.ok(c.oneThing ? "One Thing pinned." : "Task added.");
    case "protein":
      await logDiet(0, c.grams, `${c.grams} g protein`);
      return void toast.ok(`+${c.grams} g protein.`);
    case "kcal":
      await logDiet(c.calories, 0, `${c.calories} kcal`);
      return void toast.ok(`+${c.calories} kcal.`);
    case "meditate":
      await logMeditation(c.minutes, "palette");
      return void toast.ok(`${c.minutes} min logged. Calm achieved.`);
    case "english":
      await bumpPersona("english_min", c.minutes);
      return void toast.ok(`+${c.minutes} min English.`);
    case "theme":
      return ui.toggleTheme();
    case "review":
      nav("/#review");
      return;
    case "note":
      await repo.insert("notes", { section: "career", title: c.text, body_md: "" });
      nav("/career/notes");
      return void toast.ok("Note created.");
  }
}

export function CommandPalette() {
  const { paletteOpen } = useUI();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const close = () => {
    ui.set({ paletteOpen: false });
    setQ("");
    setSel(0);
  };
  const go = (p: string): void => {
    if (inScope(p)) nav(p);
    else window.open(p, "_blank");
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const cmd = parseCommand(q);
    if (cmd) out.push({ id: "cmd", label: describe(cmd), kind: "action", run: () => runCommand(cmd, go) });
    const routes = ROUTES.map(([label, path]) => ({ label, path, score: fuzzy(q, label) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8);
    for (const r of routes) out.push({ id: r.path, label: r.label, kind: "go", run: () => go(r.path) });
    if (!q)
      for (const ex of ["log water 500", "start focus 25", "log weight 52.4", "add task Read PY4E ch.8 #career", "meditate 10", "protein 30"])
        out.push({ id: ex, label: ex, kind: "try", run: () => setQ(ex) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go is stable enough
  }, [q]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => input.current?.focus(), 10);
  }, [paletteOpen]);
  useEffect(() => setSel(0), [q]);
  if (!paletteOpen) return null;

  const pick = async (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === "try") return void it.run();
    close();
    await it.run();
  };

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Icon name="search" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go anywhere or type: log water 500"
            aria-label="Command"
            aria-controls="palette-list"
            aria-activedescendant={items[sel] ? `pal-${sel}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(items.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                void pick(items[sel]);
              }
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <ul className="palette-list" id="palette-list" role="listbox">
          {items.map((it, i) => (
            <li key={it.id} id={`pal-${i}`} role="option" aria-selected={i === sel} className="palette-item" onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); void pick(it); }}>
              <Icon name={it.kind === "action" ? "bolt" : it.kind === "go" ? "arrow" : "chevron"} size={14} />
              {it.label}
              <span className="kind micro">{it.kind}</span>
            </li>
          ))}
          {!items.length ? <li className="palette-item muted">No match. Try "log water 500".</li> : null}
        </ul>
        <div className="palette-foot micro">
          <span>↑↓ move</span>
          <span>↵ run</span>
          <span>no AI, just regex</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HelpSheet() {
  const { helpOpen } = useUI();
  const rows: [string, string][] = [
    ["Ctrl/⌘ K", "Command palette"],
    ["g h · g c · g m · g b · g p · g s", "Home · Career · Mind · Body · Persona · Settings"],
    ["d", "Toggle theme"],
    ["f", "Start focus"],
    ["n", "Note at the current video time"],
    ["?", "This help"],
  ];
  return (
    <Sheet open={helpOpen} onClose={() => ui.set({ helpOpen: false })} title="Shortcuts">
      <ul className="list">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span className="mono small" style={{ width: 220, flex: "none" }}>{k}</span>
            <span className="small">{v}</span>
          </li>
        ))}
      </ul>
      <p className="xs muted" style={{ marginTop: 12 }}>Palette actions: log water 500 · log weight 52.4 · start focus 50 · add task … #mind · protein 30 · kcal 600 · meditate 10 · english 15 · note … · review · theme</p>
    </Sheet>
  );
}
