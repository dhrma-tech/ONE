// Top-bar search, YouTube-style: focusing it shows suggestions (never history); typing autocompletes across
// pages, actions, lessons, tricks and openings. Enter or click opens the result.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Cmd } from "../lib/commands";
import { commands } from "../lib/commands";
import { data } from "../lib/data";
import { go } from "../lib/router";

type Kind = "Page" | "Train" | "Lesson" | "Trick" | "Opening" | "Action";
interface Item { id: string; label: string; kind: Kind; kw?: string; href?: string; run?: () => void }

const KIND_BONUS: Record<Kind, number> = { Page: 9, Train: 8, Lesson: 6, Trick: 5, Action: 4, Opening: 0 };
const PAGES: Item[] = [
  { id: "pg:play", label: "Play vs Bobby", kind: "Page", href: "/", kw: "game play" },
  { id: "pg:learn", label: "Learn", kind: "Page", href: "/learn", kw: "lessons course" },
  { id: "pg:stats", label: "Stats", kind: "Page", href: "/stats", kw: "rating accuracy history games" },
  { id: "pg:scroll", label: "Scroll: chess videos", kind: "Page", href: "/scroll", kw: "video youtube watch library course cubicle" },
  ...([["puzzles", "Puzzles", "tactics"], ["endgames", "Endgame trainer", "tablebase"], ["openings", "Openings explorer", "repertoire"], ["tricks", "Tricks library", "knowledge"], ["challenges", "Daily plan and challenges", "streak achievements"]] as const)
    .map(([t, l, kw]): Item => ({ id: "tr:" + t, label: l, kind: "Train", href: `/train?tab=${t}`, kw })),
];
// Shown when the box is focused but empty. Ids refer to items in the full index; missing ones are skipped.
const SUGGESTED = ["pg:play", "tr:puzzles", "cmd:review-last", "tr:challenges", "ls:fork", "tk:fork", "op:Italian Game", "ls:endgame-king-and-pawn", "op:Sicilian Defense"];

let index: Promise<Item[]> | null = null;
function loadIndex(): Promise<Item[]> {
  index ??= Promise.all([
    data.lessonIndex().catch(() => []),
    data.cards().catch(() => []),
    data.openings().catch(() => []),
  ]).then(([lessons, cards, openings]) => {
    const seen = new Set<string>();
    return [
      ...lessons.map((l): Item => ({ id: "ls:" + l.id, label: l.title, kind: "Lesson", href: `/learn?l=${encodeURIComponent(l.id)}`, kw: l.section })),
      ...cards.map((c): Item => ({ id: "tk:" + c.id, label: c.title, kind: "Trick", href: `/train?tab=tricks&card=${encodeURIComponent(c.id)}`, kw: c.tags.join(" ").replace(/_/g, " ") })),
      ...openings.filter((o) => !seen.has(o.name) && seen.add(o.name))
        .map((o): Item => ({ id: "op:" + o.name, label: o.name, kind: "Opening", href: `/train?tab=openings&open=${encodeURIComponent(o.name)}`, kw: o.eco })),
    ];
  });
  return index;
}

function score(it: Item, q: string, words: string[]): number {
  const l = it.label.toLowerCase();
  const hay = l + " " + (it.kw ?? "").toLowerCase();
  if (!words.every((w) => hay.includes(w))) return 0;
  const starts = (w: string) => hay.split(/[\s:,'-]+/).some((t) => t.startsWith(w));
  let s = l.startsWith(q) ? 100 : words.every(starts) ? 60 : 25;
  if (l === q) s += 50;
  return s + KIND_BONUS[it.kind] - Math.min(20, l.length / 6);
}

const Glass = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
);
const Spark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><path d="M12 4l1.7 4.6L18.4 10.3 13.7 12 12 16.6 10.3 12 5.6 10.3l4.7-1.7z" /></svg>
);

/** Typed text stays regular, the completion is bold (like YouTube). */
function Label({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <b>{text}</b>;
  return <>{i > 0 ? <b>{text.slice(0, i)}</b> : null}<span>{text.slice(i, i + q.length)}</span><b>{text.slice(i + q.length)}</b></>;
}

export function SearchBar({ base }: { base: Cmd[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const [items, setItems] = useState<Item[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open && !items.length) void loadIndex().then(setItems); }, [open, items.length]);
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.defaultPrevented || e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) return;
      e.preventDefault(); input.current?.focus();
    };
    addEventListener("mousedown", down); addEventListener("keydown", key);
    return () => { removeEventListener("mousedown", down); removeEventListener("keydown", key); };
  }, []);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!open) return [];
    const cmdItems = [...commands.get(), ...base].map((c): Item => ({ id: "cmd:" + c.id, label: c.label, kind: "Action", kw: c.hint, run: c.run }));
    const all = [...PAGES, ...cmdItems, ...items];
    if (!query) {
      const byId = new Map(all.map((x) => [x.id, x]));
      return SUGGESTED.map((id) => byId.get(id)).filter((x): x is Item => !!x);
    }
    const words = query.split(/\s+/);
    const ranked = all.map((it) => ({ it, s: score(it, query, words) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const out: Item[] = []; let ops = 0;
    for (const { it } of ranked) {
      if (it.kind === "Opening" && ++ops > 5) continue;
      if (!out.some((o) => o.label === it.label && o.kind === it.kind)) out.push(it);
      if (out.length >= 9) break;
    }
    return out;
  }, [open, query, items, base]);
  useEffect(() => { setSel(-1); }, [query]);

  const pick = (it?: Item) => {
    if (!it) return;
    setOpen(false); setQ(""); input.current?.blur();
    if (it.run) it.run(); else if (it.href) go(it.href);
  };

  const listId = "search-list";
  return (
    <div className="search" ref={wrap} role="search">
      <div className={"search-box" + (open ? " open" : "")}>
        <span className="search-ico" aria-hidden="true"><Glass /></span>
        <input ref={input} value={q} placeholder="Search lessons, openings, tricks…" aria-label="Search Bobby"
          role="combobox" aria-expanded={open && results.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={sel >= 0 && results[sel] ? "sr-" + sel : undefined}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setSel((s) => Math.min(results.length - 1, s + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(results[sel >= 0 ? sel : 0]); }
            else if (e.key === "Escape") { e.preventDefault(); setOpen(false); input.current?.blur(); }
          }} />
        {q ? <button className="search-x" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => { setQ(""); input.current?.focus(); }}>×</button> : <kbd className="search-k" aria-hidden="true">/</kbd>}
      </div>
      {open && results.length ? (
        <div className="search-pop">
          {!query ? <p className="search-cap"><Spark /> Suggested for you</p> : null}
          <ul role="listbox" id={listId} aria-label="Suggestions">
            {results.map((it, i) => (
              <li key={it.id} id={"sr-" + i} role="option" aria-selected={i === sel} className={"search-i" + (i === sel ? " on" : "")}
                onMouseMove={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)}>
                <span className="search-ico" aria-hidden="true">{query ? <Glass /> : <Spark />}</span>
                <span className="search-l"><Label text={it.label} q={query} /></span>
                <small className={"search-kind k-" + it.kind.toLowerCase()}>{it.kind}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {open && query && !results.length && items.length ? <div className="search-pop"><p className="search-cap">No matches for “{q.trim()}”</p></div> : null}
    </div>
  );
}
