// Scroll: a calm library of chess videos, laid out like Cubicle (lazy-loaded page). Routes:
//   #/scroll                    home: Today, Latest, Paths, syllabus, search and filters
//   #/scroll?tab=saved|done|queue
//   #/scroll?s=<section>&n=<node>
//   #/scroll/watch/<id>         watch page
// Thumbnails are frames from inside each video (see cards.tsx), never the uploader's clickbait cover.
import { useEffect, useMemo, useRef, useState } from "react";
import "./cubicle.css";
import { store } from "../bridge/storage";
import { go, useRoute } from "../lib/router";
import { commands } from "../lib/commands";
import { toast } from "../components/Toast";
import { Select } from "../components/Select";
import {
  fmtClock, fmtDur, isNew, KIND_NAME, KINDS, LEVEL_NAME, LEVEL_RANGE, LEVELS, levelForRating, loadCatalogue, nearLevels,
  type Catalogue, type Kind, type Level, type Path, type Video,
} from "./data";
import { cubicle, getCubicle, loadCubicleState, useCubicle, type CubicleState } from "./store";
import { Avatar, LevelTag, NextItem, Thumb, VideoRow, Vouch, YtCard } from "./cards";
import { embedUrl, usePlayer } from "./player";
import { pomo, usePomo } from "./focus";

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};
const blocked = (e: KeyboardEvent) => e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || !!document.querySelector(".dialog-wrap");

// ---------------------------------------------------------------- shared bits
function useData() {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([loadCatalogue(), loadCubicleState()]).then(([c]) => live && setCat(c)).catch((e) => live && setErr(String(e)));
    return () => { live = false; };
  }, []);
  return { cat, err };
}

function useMyLevel(): Level {
  const [l, setL] = useState<Level>("b");
  useEffect(() => { store.getProfile().then((p) => setL(levelForRating(p?.rating))).catch(() => {}); }, []);
  return l;
}

// Weakness tags (Python weakness model) -> words to look for in node ids, titles and keywords.
const TAG_WORDS: Record<string, string[]> = {
  fork: ["fork"], pin: ["pin"], skewer: ["skewer"], discovered: ["discovered"], back_rank: ["back rank", "back-rank"],
  hanging_piece: ["hanging", "blunder"], missed_capture: ["hanging", "blunder"], missed_mate: ["mating pattern", "mate"],
  mate_threat: ["mating pattern", "mate"], double_check: ["double check"], endgame_k_p: ["pawn ending", "king and pawn", "opposition"],
  endgame_rook: ["rook ending", "lucena", "philidor"], endgame_queen: ["queen ending"], endgame_minor: ["minor piece", "bishop vs knight"],
  time_trouble: ["time management", "time scramble"], deflection: ["deflection"], removing_defender: ["removing the defender"],
  trapped_piece: ["trapped"], zwischenzug: ["zwischenzug"],
};

function useWeaknessPicks(cat: Catalogue | null, s: CubicleState): Video[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    store.getWeakness().then((w) => {
      const t = (w as { tags?: Record<string, { score?: number }> } | null)?.tags ?? {};
      setTags(Object.entries(t).filter(([k]) => !k.startsWith("phase_")).sort((a, b) => (b[1].score ?? 0) - (a[1].score ?? 0)).slice(0, 4).map(([k]) => k));
    }).catch(() => {});
  }, []);
  return useMemo(() => {
    if (!cat || !tags.length) return [];
    const out: Video[] = [];
    for (const tag of tags) {
      const words = TAG_WORDS[tag] ?? (tag.startsWith("opening_") ? ["opening principles", "opening mistakes"] : [tag.replace(/_/g, " ")]);
      let bestNode = "", best = 0;
      for (const [id, n] of cat.nodes) {
        const hay = (id + " " + n.title + " " + n.keywords.join(" ")).toLowerCase();
        const sc = words.reduce((a, w) => a + (hay.includes(w) ? (n.title.toLowerCase().includes(w) ? 3 : 1) : 0), 0);
        if (sc > best) { best = sc; bestNode = id; }
      }
      const v = (cat.byNode.get(bestNode) ?? []).find((x) => !s.done[x.i] && !s.hidden.includes(x.i) && !out.includes(x));
      if (v) out.push(v);
      if (out.length >= 5) break;
    }
    return out;
  }, [cat, tags, s.done, s.hidden]);
}

const IconChev = ({ dir }: { dir: "l" | "r" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === "l" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} /></svg>
);

/** Horizontally scrolling chip bar with edge arrows (Cubicle's). */
function ChipBar({ chips, on, pick, label }: { chips: { id: string; label: string }[]; on: string; pick: (id: string) => void; label: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = () => { const b = bar.current; if (b) setEdge({ l: b.scrollLeft > 4, r: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 }); };
  useEffect(() => { measure(); addEventListener("resize", measure); return () => removeEventListener("resize", measure); }, [chips.length]);
  useEffect(() => { bar.current?.querySelector<HTMLElement>(".on")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [on]);
  const nudge = (d: number) => bar.current?.scrollBy({ left: d * bar.current.clientWidth * 0.7, behavior: "smooth" });
  return (
    <div className="chipbar" role="group" aria-label={label}>
      {edge.l ? <button type="button" className="chip-arrow l" aria-label="Scroll chips left" onClick={() => nudge(-1)}><IconChev dir="l" /></button> : null}
      <div className="chip-scroll" ref={bar} onScroll={measure}>
        {chips.map((c) => <button key={c.id} type="button" className={"fchip" + (on === c.id ? " on" : "")} aria-pressed={on === c.id} onClick={() => pick(c.id)} data-chip={c.id}>{c.label}</button>)}
      </div>
      {edge.r ? <button type="button" className="chip-arrow r" aria-label="Scroll chips right" onClick={() => nudge(1)}><IconChev dir="r" /></button> : null}
    </div>
  );
}

/** A horizontal row of cards: slim scrollbar on hover, round arrow buttons at the edges, edge fade. */
function Shelf({ label, children }: { label: string; children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const measure = () => { const b = row.current; if (b) setEdge({ l: b.scrollLeft > 4, r: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 }); };
  useEffect(() => { measure(); addEventListener("resize", measure); return () => removeEventListener("resize", measure); });
  const nudge = (d: number) => row.current?.scrollBy({ left: d * row.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className={"shelf" + (edge.l ? " at-l" : "") + (edge.r ? " at-r" : "")} role="group" aria-label={label}>
      {edge.l ? <button type="button" className="shelf-arrow l" aria-label={`Scroll ${label} left`} onClick={() => nudge(-1)}><IconChev dir="l" /></button> : null}
      <div className="yt-shelf" ref={row} onScroll={measure}>{children}</div>
      {edge.r ? <button type="button" className="shelf-arrow r" aria-label={`Scroll ${label} right`} onClick={() => nudge(1)}><IconChev dir="r" /></button> : null}
    </div>
  );
}

// ---------------------------------------------------------------- home
type Sort = "rank" | "new" | "short";
type Len = "" | "s" | "m" | "l";
const PAGE = 24;

function Home({ cat }: { cat: Catalogue }) {
  const route = useRoute();
  const s = useCubicle();
  const myLevel = useMyLevel();
  const tab = route.q.get("tab") ?? "";
  const secId = route.q.get("s") ?? "";
  const nodeId = route.q.get("n") ?? "";
  const chip = route.q.get("c") ?? "";
  const chFilter = route.q.get("ch") ?? "";
  const [q, setQ] = useState("");
  const [levels, setLevels] = useState<Level[] | null>(null);
  const [kind, setKind] = useState<Kind | "">("");
  const [len, setLen] = useState<Len>("");
  const [sort, setSort] = useState<Sort>("rank");
  const [shown, setShown] = useState(PAGE);
  const [sel, setSel] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const lv = levels ?? (chip === "mine" ? nearLevels(myLevel) : LEVELS);
  const weak = useWeaknessPicks(cat, s);
  const listView = tab === "saved" || tab === "done" || tab === "queue" || s.prefs.view === "list";

  const list = useMemo(() => {
    const base = tab === "saved" ? s.saved.map((i) => cat.byId.get(i))
      : tab === "done" ? Object.entries(s.done).sort((a, b) => b[1] - a[1]).map(([i]) => cat.byId.get(i))
      : tab === "queue" ? s.queue.map((i) => cat.byId.get(i))
      : nodeId ? cat.byNode.get(nodeId) ?? [] : secId ? cat.bySection.get(secId) ?? [] : cat.videos;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const feed = !tab;
    let out = (base.filter(Boolean) as Video[]).filter((v) => {
      if (feed && (s.hidden.includes(v.i) || s.muted.includes(v.c))) return false;
      if (feed && !lv.includes(v.l)) return false;
      if (feed && chip === "beginner" && v.l !== "b") return false;
      if (feed && chip === "long" && (v.d ?? 0) < 2400) return false;
      if (feed && chip === "new" && !isNew(v)) return false;
      if (feed && kind && v.k !== kind) return false;
      if (feed && chFilter && v.c !== chFilter) return false;
      if (feed && s.prefs.hideOutdated && v.o) return false;
      if (feed && len) { const m = (v.d ?? 0) / 60; if (!v.d || (len === "s" ? m >= 15 : len === "m" ? m < 15 || m > 45 : m <= 45)) return false; }
      if (words.length) {
        const hay = `${v.t} ${v.c} ${cat.nodes.get(v.n)?.title ?? ""}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (feed && sort === "new") out = [...out].sort((a, b) => (b.p ?? "").localeCompare(a.p ?? ""));
    else if (feed && sort === "short") out = [...out].sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
    return out;
  }, [cat, s, tab, secId, nodeId, chip, chFilter, q, lv, kind, len, sort]);

  useEffect(() => { setSel(-1); setShown(PAGE); }, [tab, secId, nodeId, chip, chFilter, q, kind, len, sort, levels]);
  useEffect(() => {
    const el = sentinel.current; if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) setShown((n) => n + PAGE); }, { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length, shown]);
  const visible = list.slice(0, shown);

  // keys: j/k move, Enter open, s save, d done, q queue, / search, f focus mode
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "/" && !blocked(e)) { e.preventDefault(); e.stopPropagation(); searchRef.current?.focus(); return; }
      if (blocked(e)) return;
      const v = visible[sel];
      if (e.key === "j") { setSel((x) => Math.min(visible.length - 1, x + 1)); e.preventDefault(); }
      else if (e.key === "k") { setSel((x) => Math.max(0, x - 1)); e.preventDefault(); }
      else if (e.key === "Enter" && v) go(`/scroll/watch/${v.i}`);
      else if (e.key === "s" && v) cubicle.toggleSaved(v.i);
      else if (e.key === "d" && v) cubicle.toggleDone(v.i);
      else if (e.key === "q" && v) cubicle.toggleQueue(v.i);
      else if (e.key === "f") { cubicle.setPrefs({ focus: !getCubicle().prefs.focus }); toast(getCubicle().prefs.focus ? "Focus mode on" : "Focus mode off"); }
    };
    addEventListener("keydown", k, true);
    return () => removeEventListener("keydown", k, true);
  }, [visible, sel]);
  useEffect(() => { document.querySelector(".cubicle .is-sel")?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const section = cat.sections.find((x) => x.id === secId);
  const node = nodeId ? cat.nodes.get(nodeId) : undefined;
  const hasLongs = cat.videos.some((v) => (v.d ?? 0) >= 2400);
  const chips = [
    { id: "", label: "All" }, { id: "mine", label: "For your level" }, { id: "beginner", label: "Beginner friendly" },
    ...(cat.videos.some(isNew) ? [{ id: "new", label: "New" }] : []), ...(hasLongs ? [{ id: "long", label: "Longs" }] : []),
    ...cat.sections.map((x) => ({ id: "s:" + x.id, label: x.title })),
  ];
  const chipOn = secId ? "s:" + secId : chip;
  const pickChip = (id: string) => go(id.startsWith("s:") ? `/scroll?s=${id.slice(2)}` : id ? `/scroll?c=${id}` : "/scroll");
  const counts = { saved: s.saved.length, done: Object.keys(s.done).length, queue: s.queue.length };
  const isHome = !tab && !secId && !nodeId && !chip && !chFilter && !q;
  const title = tab === "saved" ? "Saved" : tab === "done" ? "Done" : tab === "queue" ? "Queue" : chFilter ? chFilter : node ? node.title : section ? section.title : chip === "mine" ? "For your level" : null;

  return (
    <div className="page cubicle">
      <header className="page-h row cb-top">
        <div>
          <h1>Scroll</h1>
          <p className="muted small">The best chess videos on YouTube, laid out as a syllabus. {cat.videos.length} videos, each recommended by independent sources or trusted teachers.</p>
        </div>
        <div className="tabs" role="tablist" aria-label="Scroll">
          {([["", "Home"], ["syllabus", "Syllabus"], ["saved", `Saved ${counts.saved || ""}`], ["done", `Done ${counts.done || ""}`], ["queue", `Queue ${counts.queue || ""}`]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={"tab" + (tab === id ? " on" : "")} onClick={() => go(id ? `/scroll?tab=${id}` : "/scroll")}>{label.trim()}</button>
          ))}
        </div>
      </header>

      {!cat.videos.length ? <p className="warnbox">The video catalogue is empty. Build it with <code>python scripts/cubicle/run_all.py</code> (see README).</p> : null}

      {tab === "syllabus" ? <Syllabus cat={cat} /> : <>
        {!tab ? <ChipBar chips={chips} on={chipOn} pick={pickChip} label="Filter the feed" /> : null}
        {section && !tab ? (
          <div className="cb-nodes">
            <ChipBar chips={[{ id: "", label: `All of ${section.title}` }, ...section.nodes.filter((n) => cat.byNode.get(n.id)?.length).map((n) => ({ id: n.id, label: `${n.title} ${cat.byNode.get(n.id)?.length ?? 0}` }))]}
              on={nodeId} pick={(id) => go(id ? `/scroll?s=${secId}&n=${id}` : `/scroll?s=${secId}`)} label="Topics" />
          </div>
        ) : null}

        {isHome ? <Overview cat={cat} s={s} myLevel={myLevel} weak={weak} /> : null}

        <div className="cb-bar">
          {title ? <h2 className="sub-h cb-ttl">{title} <small className="muted">{list.length}</small></h2> : null}
          {node?.practice ? <a className="btn btn-soft cb-practice" href={node.practice}>Practice this in Bobby</a> : null}
          {tab === "queue" && s.queue.length ? <button className="textlink" onClick={() => cubicle.clearQueue()}>Clear queue</button> : null}
          {chFilter ? <button className="textlink" onClick={() => go("/scroll")}>Show all channels</button> : null}
        </div>
        <div className="cb-search">
          <input ref={searchRef} type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles, channels and topics  ( / )" aria-label="Search videos" data-testid="cubicle-search" />
        </div>
        {!tab ? (
          <div className="cb-filters" role="group" aria-label="Filters">
            <span className="cb-fgroup" role="group" aria-label="Level">
              {LEVELS.map((l) => (
                <button key={l} className={"chip" + (lv.includes(l) ? " on" : "")} aria-pressed={lv.includes(l)} title={LEVEL_RANGE[l]}
                  onClick={() => setLevels(lv.includes(l) ? lv.filter((x) => x !== l) : [...lv, l])} data-testid={`lv-${l}`}>{LEVEL_NAME[l]}</button>
              ))}
            </span>
            <span className="cb-fgroup" role="group" aria-label="Length">
              {([["s", "< 15 min"], ["m", "15–45 min"], ["l", "> 45 min"]] as const).map(([k, label]) => (
                <button key={k} className={"chip" + (len === k ? " on" : "")} aria-pressed={len === k} onClick={() => setLen(len === k ? "" : k)}>{label}</button>
              ))}
            </span>
            <Select value={kind} onChange={(e) => setKind(e.target.value as Kind | "")} aria-label="Kind">
              <option value="">Any kind</option>{KINDS.map((k) => <option key={k} value={k}>{KIND_NAME[k]}</option>)}
            </Select>
            <Select value={chFilter} onChange={(e) => go(e.target.value ? `/scroll?ch=${encodeURIComponent(e.target.value)}` : "/scroll")} aria-label="Channel">
              <option value="">Any channel</option>{cat.channels.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="rank">Best first</option><option value="new">Newest</option><option value="short">Shortest</option>
            </Select>
            <label className="check"><input type="checkbox" checked={s.prefs.hideOutdated} onChange={(e) => cubicle.setPrefs({ hideOutdated: e.target.checked })} /> Hide outdated</label>
            <Select value={s.prefs.thumb} onChange={(e) => cubicle.setPrefs({ thumb: e.target.value as "mid" | "default" })} aria-label="Thumbnails">
              <option value="mid">Thumbnail: frame from the video</option><option value="default">Thumbnail: uploader's cover</option>
            </Select>
            <label className="check"><input type="checkbox" checked={s.prefs.preview} onChange={(e) => cubicle.setPrefs({ preview: e.target.checked })} /> Preview on hover</label>
            <span className="cb-view" role="group" aria-label="View">
              <button className={"chip" + (s.prefs.view === "grid" ? " on" : "")} aria-pressed={s.prefs.view === "grid"} onClick={() => cubicle.setPrefs({ view: "grid" })}>Grid</button>
              <button className={"chip" + (s.prefs.view === "list" ? " on" : "")} aria-pressed={s.prefs.view === "list"} onClick={() => cubicle.setPrefs({ view: "list" })}>List</button>
            </span>
          </div>
        ) : null}

        {visible.length ? (listView ? (
          <div className="rows" data-testid="cubicle-list" data-count={list.length}>{visible.map((v, i) => <VideoRow key={v.i} v={v} cat={cat} sel={i === sel} />)}</div>
        ) : (
          <div className="yt-grid" role="feed" aria-label="Videos" data-testid="cubicle-list" data-count={list.length}>{visible.map((v, i) => <YtCard key={v.i} v={v} cat={cat} home={!tab} sel={i === sel} />)}</div>
        )) : (
          <div className="empty"><h2>{tab ? "Nothing here yet" : "Nothing to show here"}</h2>
            <p>{tab ? "Use the Save, Queue and Done buttons on any video." : s.hidden.length + s.muted.length ? "You have hidden some videos or channels." : "Try another topic or fewer filters."}</p></div>
        )}
        {list.length > shown ? <div ref={sentinel} className="sentinel"><button type="button" className="more" onClick={() => setShown((n) => n + PAGE)}>Show more</button></div>
          : list.length ? <p className="end">That is everything in this view.</p> : null}
        <p className="muted small cb-keys">Keys: j / k move · Enter open · s save · d done · q queue · / search · f focus mode</p>
      </>}
    </div>
  );
}

function Syllabus({ cat }: { cat: Catalogue }) {
  return (
    <div className="cb-syl">
      {cat.sections.map((sec) => (
        <section key={sec.id} className="cb-syl-sec">
          <h2><a href={`#/scroll?s=${sec.id}`}>{sec.title}</a> <small className="muted">{cat.bySection.get(sec.id)?.length ?? 0} videos</small></h2>
          {sec.blurb ? <p className="muted small">{sec.blurb}</p> : null}
          <ul>{sec.nodes.map((n) => {
            const c = cat.byNode.get(n.id)?.length ?? 0;
            return <li key={n.id} className={c ? "" : "empty-node"}>{c ? <a href={`#/scroll?s=${sec.id}&n=${n.id}`}>{n.title}</a> : <span>{n.title}</span>} <small className="muted">{c}</small></li>;
          })}</ul>
        </section>
      ))}
    </div>
  );
}

function pickForLevel(cat: Catalogue, s: CubicleState, l: Level): Video | undefined {
  return cat.videos.find((v) => v.l === l && !s.done[v.i] && !s.hidden.includes(v.i) && ["start", "tactics", "strategy", "endgames", "improve"].includes(v.s))
    ?? cat.videos.find((v) => !s.done[v.i]);
}
function pathNext(p: Path, s: CubicleState): number {
  let i = s.paths[p.id] ?? 0;
  while (i < p.videos.length && s.done[p.videos[i]]) i++;
  return i;
}

function Overview({ cat, s, myLevel, weak }: { cat: Catalogue; s: CubicleState; myLevel: Level; weak: Video[] }) {
  const cont = s.current && s.positions[s.current] && !s.done[s.current] ? cat.byId.get(s.current) : undefined;
  const activePath = cat.paths.find((p) => s.paths[p.id] !== undefined && pathNext(p, s) < p.videos.length);
  const pathVid = activePath ? cat.byId.get(activePath.videos[pathNext(activePath, s)]) : undefined;
  const today = cont ?? pathVid ?? pickForLevel(cat, s, myLevel);
  const why = cont ? `Continue watching from ${fmtClock(s.positions[cont.i])}` : pathVid ? `Next in your path: ${activePath?.title}` : `Picked for your level (${LEVEL_NAME[myLevel]})`;

  const buildQueue = (min: number) => {
    const picks: string[] = [];
    let total = 0;
    for (const v of cat.videos) {
      if (s.done[v.i] || s.hidden.includes(v.i) || s.queue.includes(v.i) || !nearLevels(myLevel).includes(v.l)) continue;
      const m = v.d ? v.d / 60 : 15; // unknown length counts as 15 minutes
      if (total + m > min) continue;
      picks.push(v.i); total += m;
      if (total >= min - 4) break;
    }
    if (!picks.length) { toast("Nothing fits that time. Try a longer budget."); return; }
    cubicle.setPrefs({ budget: min });
    cubicle.enqueue(picks);
    toast(`Queued ${picks.length} video${picks.length === 1 ? "" : "s"} (about ${Math.round(total)} min)`);
    go(`/scroll/watch/${picks[0]}`);
  };

  return (
    <div className="cb-overview">
      {today ? (
        <section className="cb-today" aria-label="Today">
          <a className="cb-today-thumb" href={`#/scroll/watch/${today.i}`} tabIndex={-1} aria-hidden="true"><Thumb v={today} cat={cat} big /></a>
          <div className="cb-today-body">
            <small className="muted">Today · {why}</small>
            <a className="cb-today-t" href={`#/scroll/watch/${today.i}`}>{today.t}</a>
            <p className="row-meta"><span>{today.c}</span><LevelTag v={today} />{today.d ? <span>{fmtDur(today.d)}</span> : null}</p>
            <div className="cb-budget" role="group" aria-label="Time budget">
              <span className="muted small">Got time? Build a queue:</span>
              {[15, 30, 60].map((m) => <button key={m} className={"chip" + (s.prefs.budget === m ? " on" : "")} onClick={() => buildQueue(m)}>{m} min</button>)}
            </div>
          </div>
        </section>
      ) : null}

      {weak.length ? (
        <section aria-label="For your weaknesses">
          <h2 className="sub-h">For your weaknesses <small className="muted">from the mistakes in your games</small></h2>
          <Shelf label="For your weaknesses">{weak.map((v) => <YtCard key={v.i} v={v} cat={cat} />)}</Shelf>
        </section>
      ) : null}

      {cat.latest.length ? (
        <section aria-label="Latest">
          <h2 className="sub-h">Latest <small className="muted">from trusted channels</small></h2>
          <Shelf label="Latest">{cat.latest.slice(0, 10).map((v) => <YtCard key={v.i} v={v} cat={cat} />)}</Shelf>
        </section>
      ) : null}

      {cat.paths.length ? (
        <section aria-label="Paths">
          <h2 className="sub-h">Paths</h2>
          <div className="cb-paths">
            {cat.paths.map((p) => {
              const n = pathNext(p, s), started = s.paths[p.id] !== undefined;
              const first = cat.byId.get(p.videos[Math.min(n, p.videos.length - 1)]);
              return (
                <article key={p.id} className="cb-path">
                  {first ? <a className="cb-path-cover" href={`#/scroll/watch/${first.i}?path=${p.id}`} tabIndex={-1} aria-hidden="true"><Thumb v={first} cat={cat} /><span className="cb-path-n">{p.videos.length} videos</span></a> : null}
                  <div>
                    <strong>{p.title}</strong>
                    <small className="muted block">{p.blurb ?? ""}{started ? ` ${Math.min(n, p.videos.length)}/${p.videos.length} done.` : ""}</small>
                    <button className="btn btn-soft" onClick={() => { cubicle.setPathStep(p.id, n); const id = p.videos[Math.min(n, p.videos.length - 1)]; go(`/scroll/watch/${id}?path=${p.id}`); }}>{started ? (n >= p.videos.length ? "Review" : "Continue") : "Start"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      <h2 className="sub-h cb-feed-h">Recommended</h2>
    </div>
  );
}


// ---------------------------------------------------------------- watch
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
function notesMarkdown(v: Video, notes: { t: number; text: string }[]) {
  const url = `https://youtu.be/${v.i}`;
  return `# Notes: ${v.t}\n${v.c} · ${url}\n\n` + notes.map((n) => `- [${fmtClock(n.t)}](${url}?t=${n.t}) ${n.text}`).join("\n") + "\n";
}
const LEVEL_ORDER: Record<Level, number> = { b: 0, i: 1, a: 2, x: 3 };

function PomoChip() {
  const p = usePomo();
  return (
    <span className={"cb-pomo" + (p.running ? " on" : "") + (p.phase === "break" ? " brk" : "")} role="group" aria-label="Study timer">
      <button className="chip" onClick={() => (p.running ? pomo.pause() : pomo.start())} title="25 min study (counts only while the video plays), 5 min break" data-testid="pomo">
        {fmtClock(p.left)} {p.phase === "work" ? (p.running && !p.videoPlaying ? "study · paused with video" : "study") : "break"}
      </button>
      {p.running || p.left !== p.work * 60 ? <button className="textlink" onClick={pomo.reset}>Reset</button> : null}
      {p.cycles ? <small className="muted">{p.cycles} done</small> : null}
    </span>
  );
}

function Watch({ cat, id }: { cat: Catalogue; id: string }) {
  const route = useRoute();
  const s = useCubicle();
  const p = usePomo();
  const v = cat.byId.get(id);
  const pathId = route.q.get("path");
  const path = pathId ? cat.paths.find((x) => x.id === pathId) : undefined;
  const frame = useRef<HTMLIFrameElement>(null);
  // Like Cubicle, the official player loads straight away (it shows its own preview frame). It only starts by itself
  // when you arrive through auto-next from your queue.
  const autoplay = route.q.get("auto") === "1";
  const startAt = useMemo(() => Math.floor(getCubicle().positions[id] || 0), [id]);
  const speed = s.speeds[id] ?? s.prefs.speed;
  const lastSave = useRef(0);
  const [upnext, setUpnext] = useState<{ id: string; left: number } | null>(null);
  const [stamp, setStamp] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const noteIn = useRef<HTMLInputElement>(null);
  const focus = s.prefs.focus;

  useEffect(() => { cubicle.setCurrent(id); setUpnext(null); setStamp(null); setDraft(""); }, [id]);
  useEffect(() => { document.body.classList.toggle("cb-focus", focus); return () => document.body.classList.remove("cb-focus"); }, [focus]);
  useEffect(() => () => pomo.setVideoPlaying(false), []);

  const nextAfter = () => {
    const cur = getCubicle();
    if (path) { const i = path.videos.indexOf(id); return path.videos[i + 1]; }
    const i = cur.queue.indexOf(id);
    return i >= 0 ? cur.queue[i + 1] : cur.queue[0];
  };
  const player = usePlayer(frame, id, {
    speed,
    onRate: (r) => cubicle.setSpeed(id, r),
    onPlaying: (pl) => pomo.setVideoPlaying(pl),
    onTick: (t, d) => {
      if (Math.abs(t - lastSave.current) >= 5) { const dt = Math.min(10, Math.abs(t - lastSave.current)); lastSave.current = t; cubicle.setPosition(id, t, d); cubicle.addWatched(dt); }
    },
    onEnd: () => {
      cubicle.setPosition(id, 0);
      const next = nextAfter();
      cubicle.markDone(id);
      if (path) cubicle.setPathStep(path.id, path.videos.indexOf(id) + 1);
      cubicle.dequeue(id);
      if (getCubicle().prefs.autoNext && next) setUpnext({ id: next, left: 5 });
    },
  });

  useEffect(() => {
    if (!upnext) return;
    if (upnext.left <= 0) { go(`/scroll/watch/${upnext.id}?auto=1${path ? `&path=${path.id}` : ""}`); return; }
    const t = setTimeout(() => setUpnext((u) => (u ? { ...u, left: u.left - 1 } : u)), 1000);
    return () => clearTimeout(t);
  }, [upnext, path]);

  // keys: n note, s save, d done, q queue, f focus
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (blocked(e)) return;
      if (e.key === "n") { e.preventDefault(); setStamp(Math.floor(player.now())); noteIn.current?.focus(); }
      else if (e.key === "s") cubicle.toggleSaved(id);
      else if (e.key === "d") cubicle.toggleDone(id);
      else if (e.key === "q") cubicle.toggleQueue(id);
      else if (e.key === "f") cubicle.setPrefs({ focus: !getCubicle().prefs.focus });
      else if (e.key === "Escape" && upnext) setUpnext(null);
    };
    addEventListener("keydown", k, true);
    return () => removeEventListener("keydown", k, true);
  }, [id, player, upnext]);

  if (!v) return <div className="page empty"><h1>Video not found</h1><p>It may have been removed from the catalogue. <a href="#/scroll">Back to Scroll</a></p></div>;
  const node = cat.nodes.get(v.n);
  const sec = cat.sections.find((x) => x.id === v.s);
  const notes = s.notes[id] ?? [];
  const saved = s.saved.includes(id), done = !!s.done[id], queued = s.queue.includes(id);
  const more = (cat.byNode.get(v.n) ?? []).filter((x) => x.i !== id && !s.hidden.includes(x.i))
    .sort((a, b) => LEVEL_ORDER[a.l] - LEVEL_ORDER[b.l] || b.sc - a.sc).slice(0, 8);
  const queueVids = s.queue.map((q) => cat.byId.get(q)).filter((x): x is Video => !!x);
  const nextVid = upnext ? cat.byId.get(upnext.id) : undefined;

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    cubicle.addNote(id, stamp ?? player.now(), draft);
    setDraft(""); setStamp(null);
  };
  const exportMd = () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([notesMarkdown(v, notes)], { type: "text/markdown" })), download: `notes-${v.i}.md` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className={"page cb-watch" + (focus ? " is-focus" : "")}>
      <div className="cb-watch-main">
        <p className="cb-crumb small"><a href="#/scroll">Scroll</a>{sec ? <> · <a href={`#/scroll?s=${sec.id}`}>{sec.title}</a></> : null}{node ? <> · <a href={`#/scroll?s=${v.s}&n=${v.n}`}>{node.title}</a></> : null}{path ? <> · Path: {path.title} ({path.videos.indexOf(id) + 1}/{path.videos.length})</> : null}</p>
        <div className="cb-player">
          <iframe ref={frame} key={id} title={v.t} src={embedUrl(v.i, startAt, autoplay)} data-testid="cubicle-embed"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
        {upnext && nextVid ? (
          <div className="cb-upnext" role="status">
            <span>Up next in {upnext.left}s: <b>{nextVid.t}</b></span>
            <button className="btn btn-soft" onClick={() => go(`/scroll/watch/${nextVid.i}?auto=1${path ? `&path=${path.id}` : ""}`)}>Play now</button>
            <button className="btn" onClick={() => setUpnext(null)}>Cancel</button>
          </div>
        ) : null}
        {p.summary ? (
          <div className="cb-summary" role="status" data-testid="pomo-summary">
            <strong>Study block done.</strong> {p.summary.minutes} min of watching, {p.summary.videos} video{p.summary.videos === 1 ? "" : "s"} finished, {p.summary.notes} note{p.summary.notes === 1 ? "" : "s"}. Take a 5 minute break.
            <button className="textlink" onClick={pomo.dismissSummary}>Close</button>
          </div>
        ) : null}
        <h1 className="cb-wtitle">{v.t}</h1>
        <div className="cb-meta">
          <Avatar name={v.c} /><span className="cb-ch">{v.c}</span><LevelTag v={v} /><span className="tag tag-kind">{KIND_NAME[v.k]}</span>{v.d ? <span>{fmtDur(v.d)}</span> : null}{v.p ? <span>{v.p}</span> : null}{v.o ? <span className="tag tag-old">May be outdated</span> : null}
          {startAt ? <span className="cb-resume">Resumed at {fmtClock(startAt)}</span> : null}
        </div>
        <div className="cb-tools" role="toolbar" aria-label="Video tools">
          <button className={"btn" + (saved ? " btn-primary" : "")} aria-pressed={saved} onClick={() => cubicle.toggleSaved(id)}>{saved ? "Saved" : "Save"}</button>
          <button className={"btn" + (done ? " btn-primary" : "")} aria-pressed={done} onClick={() => cubicle.toggleDone(id)}>{done ? "Done" : "Mark done"}</button>
          <button className={"btn" + (queued ? " btn-primary" : "")} aria-pressed={queued} onClick={() => cubicle.toggleQueue(id)}>{queued ? "In queue" : "Queue"}</button>
          <button className={"btn" + (focus ? " btn-primary" : "")} aria-pressed={focus} onClick={() => cubicle.setPrefs({ focus: !focus })} data-testid="focus-btn">{focus ? "Exit focus" : "Focus"}</button>
          <span className="cb-speeds" role="group" aria-label="Playback speed">
            {SPEEDS.map((r) => <button key={r} className={speed === r ? "on" : ""} aria-pressed={speed === r} onClick={() => { cubicle.setSpeed(id, r); player.setRate(r); }}>{r}x</button>)}
          </span>
          <PomoChip />
        </div>

        <section className="cb-notes" aria-labelledby="cb-notes-h">
          <header><h2 id="cb-notes-h" className="sub-h">Notes {notes.length ? <small className="muted">{notes.length}</small> : null}</h2>
            {notes.length ? <button className="textlink" onClick={exportMd}>Export Markdown</button> : null}</header>
          <form onSubmit={addNote} className="cb-note-form">
            <button type="button" className="chip" onClick={() => setStamp(Math.floor(player.now()))} title="Stamp the current time (n)">{fmtClock(stamp ?? player.time)}</button>
            <input ref={noteIn} type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Note at this moment. Press n to stamp the time." aria-label="Note text" data-testid="note-input" />
            <button type="submit" className="btn" disabled={!draft.trim()}>Add</button>
          </form>
          {notes.length ? (
            <ul className="cb-note-list">{notes.map((n) => (
              <li key={n.id}>
                <button className="chip" onClick={() => player.seek(n.t)} aria-label={`Jump to ${fmtClock(n.t)}`}>{fmtClock(n.t)}</button>
                <span>{n.text}</span>
                <button className="textlink" onClick={() => cubicle.delNote(id, n.id)} aria-label="Delete note">Delete</button>
              </li>
            ))}</ul>
          ) : <p className="muted small">Notes stay on this device. Click a time to jump back to it.</p>}
        </section>

        {!focus ? (
          <section className="cb-why-box" aria-label="Why it's here" data-testid="vouch-box">
            <h2 className="sub-h">Why it's here</h2>
            <Vouch v={v} wide />
            <ul className="small">
              {v.sr ? <li>Recommended by {v.sr} independent source{v.sr === 1 ? "" : "s"}: {v.src.join(", ")}.</li> : null}
              {v.tr && v.tr <= 2 ? <li>From a trusted {v.tr === 1 ? "teaching" : "chess"} channel.</li> : null}
              {v.o ? <li className="warn">This topic moves fast and the video is older: it may be outdated.</li> : null}
            </ul>
          </section>
        ) : null}
      </div>

      {!focus ? (
        <aside className="cb-watch-side" aria-label="Practice and up next" data-testid="watch-side">
          {node?.practice ? (
            <section className="card cb-practice-card">
              <h2 className="sub-h">Practice this</h2>
              <p className="small muted">Try what you just watched on Bobby's board.</p>
              <a className="btn btn-primary" href={node.practice}>Open practice</a>
            </section>
          ) : null}
          {queueVids.length ? (
            <section>
              <h2 className="sub-h">Your queue <small className="muted">{queueVids.length}</small></h2>
              <ol className="next">{queueVids.slice(0, 8).map((x) => <NextItem key={x.i} v={x} cat={cat} cur={x.i === id}
                after={<button type="button" className="q-x" onClick={() => cubicle.dequeue(x.i)} aria-label={`Remove ${x.t} from queue`}>×</button>} />)}</ol>
              <label className="check small"><input type="checkbox" checked={s.prefs.autoNext} onChange={(e) => cubicle.setPrefs({ autoNext: e.target.checked })} /> Play the next one automatically (5 s countdown)</label>
            </section>
          ) : null}
          {more.length ? (
            <section>
              <h2 className="sub-h">Up next in {node?.title ?? "this topic"}</h2>
              <ol className="next">{more.map((x) => (
                <NextItem key={x.i} v={x} cat={cat}
                  after={<button type="button" className={"q-x add" + (s.queue.includes(x.i) ? " on" : "")} onClick={() => cubicle.toggleQueue(x.i)} aria-label={`${s.queue.includes(x.i) ? "Remove from" : "Add to"} queue: ${x.t}`}>{s.queue.includes(x.i) ? "✓" : "+"}</button>} />
              ))}</ol>
            </section>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- entry
export default function Cubicle() {
  const route = useRoute();
  const { cat, err } = useData();
  const [, sub, id] = route.path; // ["scroll", "watch", id]

  useEffect(() => {
    commands.set([
      { id: "cb-focus", label: "Scroll: toggle focus mode", hint: "Scroll", keys: "F", run: () => cubicle.setPrefs({ focus: !getCubicle().prefs.focus }) },
      { id: "cb-saved", label: "Scroll: saved videos", hint: "Scroll", run: () => go("/scroll?tab=saved") },
      { id: "cb-queue", label: "Scroll: queue", hint: "Scroll", run: () => go("/scroll?tab=queue") },
      { id: "cb-search", label: "Scroll: search videos", hint: "Scroll", keys: "/", run: () => { go("/scroll"); setTimeout(() => (document.querySelector('[data-testid="cubicle-search"]') as HTMLInputElement | null)?.focus(), 50); } },
    ]);
    return () => commands.clear();
  }, []);

  if (err) return <div className="page empty"><h1>Scroll</h1><p className="err">{err}</p></div>;
  if (!cat) return <div className="loading">Loading Scroll…</div>;
  return sub === "watch" && id ? <Watch cat={cat} id={id} key={id} /> : <Home cat={cat} />;
}
