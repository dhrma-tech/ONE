// Scroll video cards, modelled on Cubicle's: thumbnail = a frame from inside the video (YouTube's auto-generated
// hq1/hq2/hq3 frames at about 25/50/75% of the timeline), never the uploader's clickbait cover, unless the frame is
// missing (then the default thumbnail is the fallback) or the viewer chose "uploader's thumbnail".
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "../components/Toast";
import { fmtDur, isNew, KIND_NAME, LEVEL_NAME, type Catalogue, type Video } from "./data";
import { cubicle, useCubicle } from "./store";

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
/** One of the three timeline frames, chosen per video so it is stable across visits. */
export const frameFile = (id: string) => `hq${(hash(id) % 3) + 1}.jpg`;
export const thumbUrl = (id: string, file: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/${file}`;

/* ---------- icons ---------- */
const I = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const IconSave = ({ on }: { on?: boolean }) => <I fill={on} d="M6 3.5h12v17l-6-4-6 4z" />;
export const IconCheck = () => <I d="M4.5 12.5l5 5 10-11" />;
export const IconQueue = () => <I d="M4 6h12M4 12h12M4 18h8M17 15v6M14 18h6" />;
const IconDots = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
);

/* ---------- thumbnail ---------- */
/** Frames to try, best first: the chosen large frame, the other large frames, medium, then small frames.
 *  The uploader's cover (hqdefault) is only used when the viewer picked it in the view options. */
function frameChain(id: string): string[] {
  const n = (hash(id) % 3) + 1;
  const order = [n, ...[1, 2, 3].filter((x) => x !== n)];
  return [...order.map((x) => `hq${x}.jpg`), `mq${n}.jpg`, ...order.map((x) => `${x}.jpg`)];
}

export function Thumb({ v, cat, big }: { v: Video; cat: Catalogue; big?: boolean }) {
  const s = useCubicle();
  const chain = s.prefs.thumb === "default" ? ["hqdefault.jpg"] : frameChain(v.i);
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); }, [v.i, s.prefs.thumb]);
  const file = chain[step];
  const next = () => setStep((k) => k + 1);
  return (
    <span className={"thumb" + (big ? " thumb-big" : "") + (file ? "" : " thumb-none")}>
      {file ? (
        <img key={file} src={thumbUrl(v.i, file)} alt="" loading="lazy" decoding="async" data-thumb={file}
          // YouTube answers a missing frame with a 120x90 grey placeholder; large frames are 480 wide.
          onLoad={(e) => { if (file.startsWith("hq") && file !== "hqdefault.jpg" && e.currentTarget.naturalWidth <= 120) next(); }}
          onError={next} />
      ) : <span className="thumb-ph" aria-hidden="true">♞</span>}
      {v.d ? <span className="dur">{fmtDur(v.d)}</span> : null}
      <FreshBar v={v} cat={cat} />
    </span>
  );
}

/* ---------- freshness: drains with age, hatched when it may be outdated ---------- */
export function freshText(v: Video, cat: Catalogue) {
  const shelf = cat.nodes.get(v.n)?.shelf ?? "evergreen";
  const base = shelf === "fast" ? "Fast-moving topic (events, tools)." : shelf === "semi" ? "Changes over a few years (theory, plans)." : "Evergreen.";
  return `${base} Freshness ${Math.round(v.f * 100)}%${v.p ? `, published ${v.p}` : ""}.${v.o ? " It may be outdated." : ""}`;
}
export function FreshBar({ v, cat }: { v: Video; cat: Catalogue }) {
  if ((cat.nodes.get(v.n)?.shelf ?? "evergreen") === "evergreen") return <span className="fresh fresh-ever" title={freshText(v, cat)} />;
  return <span className={"fresh" + (v.o ? " fresh-old" : "")} title={freshText(v, cat)}><i style={{ width: `${Math.max(6, Math.round(v.f * 100))}%` }} /></span>;
}

/* ---------- vouch: independent recommendations ---------- */
const vouchDots = (v: Video, max: number) => Math.min(max, Math.max(v.sr || v.tr ? 1 : 0, v.sr + (v.tr === 1 ? 1 : 0)));
export const vouchLabel = (v: Video) => (v.sr ? `${v.sr} independent ${v.sr === 1 ? "recommendation" : "recommendations"}` : v.tr && v.tr <= 2 ? "Trusted channel" : "Recommended");
export function Vouch({ v, wide }: { v: Video; wide?: boolean }) {
  const dots = vouchDots(v, 5);
  return (
    <span className={"vouch" + (wide ? " vouch-wide" : "")} title={v.src.length ? `Recommended by: ${v.src.join(", ")}` : vouchLabel(v)}>
      <span className="dots" aria-hidden="true">{[0, 1, 2, 3, 4].map((k) => <i key={k} className={k < dots ? "on" : ""} />)}</span>
      <span className="vouch-text"><span>{vouchLabel(v)}</span></span>
    </span>
  );
}
export const LevelTag = ({ v }: { v: Video }) => <span className={`tag tag-${v.l}`}>{LEVEL_NAME[v.l]}</span>;

const hue = (s: string) => hash(s) % 360;
export const Avatar = ({ name }: { name: string }) => (
  <span className="avatar" style={{ background: `hsl(${hue(name)} 38% 32%)` }} aria-hidden="true">{(name.trim()[0] || "?").toUpperCase()}</span>
);

/* ---------- toggles with an undo toast, like Cubicle ---------- */
export const toggleSave = (id: string, was: boolean) => { cubicle.toggleSaved(id); toast(was ? "Removed from Saved" : "Saved"); };
export const toggleDone = (id: string, was: boolean) => { cubicle.toggleDone(id); toast(was ? "Marked as not done" : "Marked as done"); };
export const toggleQueue = (id: string, was: boolean) => { cubicle.toggleQueue(id); toast(was ? "Removed from queue" : "Added to queue"); };

const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- YouTube-style card (grid) ---------- */
export function YtCard({ v, cat, home, sel }: { v: Video; cat: Catalogue; home?: boolean; sel?: boolean }) {
  const s = useCubicle();
  const [prev, setPrev] = useState(false);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const timer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const saved = s.saved.includes(v.i), done = !!s.done[v.i], queued = s.queue.includes(v.i);
  const node = cat.nodes.get(v.n);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); box.current?.querySelector<HTMLElement>(".kebab")?.focus(); } };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menu]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = v.d ? Math.max(5, Math.floor(v.d * 0.3)) : 45;
  const preview = `https://www.youtube-nocookie.com/embed/${v.i}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&start=${start}`;
  const meta = [v.sr ? `${v.sr} ${v.sr === 1 ? "source" : "sources"}` : v.tr && v.tr <= 2 ? "Trusted channel" : "", LEVEL_NAME[v.l]].filter(Boolean);
  const item = (label: string, fn: () => void) => <button type="button" role="menuitem" onClick={() => { setMenu(false); fn(); }}>{label}</button>;
  const copy = () => { (navigator.clipboard?.writeText(`https://youtu.be/${v.i}`) ?? Promise.reject()).then(() => toast("Link copied")).catch(() => toast("Could not copy the link.")); };

  return (
    <article className={"yt" + (done ? " yt-done" : "") + (sel ? " is-sel" : "")} data-video={v.i}>
      <div className="yt-thumbwrap"
        onPointerEnter={(e) => { if (e.pointerType !== "mouse" || !s.prefs.preview || reduced()) return; timer.current = window.setTimeout(() => setPrev(true), 700); }}
        onPointerLeave={() => { clearTimeout(timer.current); setPrev(false); setReady(false); }}>
        <a className="yt-thumb" href={`#/scroll/watch/${v.i}`} aria-label={v.t} tabIndex={-1}>
          <Thumb v={v} cat={cat} big />
          {prev ? <iframe className={"preview" + (ready ? " ready" : "")} src={preview} title="" tabIndex={-1} aria-hidden="true" allow="autoplay; encrypted-media" onLoad={() => setReady(true)} /> : null}
          {done ? <span className="badge-done">Done</span> : isNew(v) ? <span className="badge-done badge-new">New</span> : null}
        </a>
        <span className="qa">
          <button type="button" className={"qbtn" + (saved ? " on" : "")} aria-label={saved ? "Remove from Saved" : "Save"} title={saved ? "Saved" : "Save"} onClick={() => toggleSave(v.i, saved)}><IconSave on={saved} /></button>
          <button type="button" className={"qbtn" + (queued ? " on" : "")} aria-label={queued ? "Remove from queue" : "Add to queue"} title={queued ? "In queue" : "Queue"} onClick={() => toggleQueue(v.i, queued)}><IconQueue /></button>
          <button type="button" className={"qbtn" + (done ? " on" : "")} aria-label={done ? "Mark as not done" : "Mark as done"} title={done ? "Done" : "Mark done"} onClick={() => toggleDone(v.i, done)}><IconCheck /></button>
        </span>
      </div>
      <div className="yt-info">
        <a href={`#/scroll?ch=${encodeURIComponent(v.c)}`} className="yt-avatar" tabIndex={-1} aria-hidden="true"><Avatar name={v.c} /></a>
        <div className="yt-text">
          <h3 className="yt-title"><a href={`#/scroll/watch/${v.i}`} title={v.t}>{v.t}</a></h3>
          <a className="yt-channel" href={`#/scroll?ch=${encodeURIComponent(v.c)}`}>{v.c}</a>
          <p className="yt-meta"><span className="mini-dots" aria-hidden="true">{[0, 1, 2].map((k) => <i key={k} className={k < vouchDots(v, 3) ? "on" : ""} />)}</span><span>{meta.join(" · ")}</span></p>
          {node || v.o || s.positions[v.i] ? (
            <p className="yt-tags">
              {node ? <a className="node-link" href={`#/scroll?s=${v.s}&n=${v.n}`}>{node.title}</a> : null}
              {v.o ? <span className="tag tag-old" title={freshText(v, cat)}>May be outdated</span> : null}
              {s.positions[v.i] && !done ? <span className="seen">Started</span> : null}
            </p>
          ) : null}
        </div>
        <div className="yt-menu" ref={box}>
          <button type="button" className="kebab" aria-label="More actions" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><IconDots /></button>
          {menu ? (
            <div className="menu" role="menu" aria-label="Video actions">
              {item(saved ? "Remove from Saved" : "Save", () => toggleSave(v.i, saved))}
              {item(queued ? "Remove from queue" : "Add to queue", () => toggleQueue(v.i, queued))}
              {item(done ? "Mark as not done" : "Mark as done", () => toggleDone(v.i, done))}
              {item("Copy link", copy)}
              <a role="menuitem" href={`https://www.youtube.com/watch?v=${v.i}`} target="_blank" rel="noreferrer noopener" onClick={() => setMenu(false)}>Open on YouTube</a>
              {home ? <hr /> : null}
              {home ? item("Not interested", () => { cubicle.hide(v.i); toast("Video hidden from your feed"); }) : null}
              {home ? item("Don't recommend this channel", () => { cubicle.muteChannel(v.c); toast(`Hiding ${v.c} from your feed`); }) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/* ---------- catalogue row (list views) ---------- */
export function VideoRow({ v, cat, sel, extra }: { v: Video; cat: Catalogue; sel?: boolean; extra?: ReactNode }) {
  const s = useCubicle();
  const node = cat.nodes.get(v.n);
  const saved = s.saved.includes(v.i), done = !!s.done[v.i], queued = s.queue.includes(v.i);
  return (
    <article className={"row" + (done ? " row-done" : "") + (sel ? " is-sel" : "")} data-video={v.i}>
      <a className="row-thumb" href={`#/scroll/watch/${v.i}`} tabIndex={-1} aria-hidden="true"><Thumb v={v} cat={cat} /></a>
      <div className="row-main">
        <h3 className="row-title"><a href={`#/scroll/watch/${v.i}`}>{v.t}</a></h3>
        <p className="row-meta">
          <span>{v.c}</span><LevelTag v={v} /><span className="tag tag-kind">{KIND_NAME[v.k]}</span>
          {node ? <a className="node-link" href={`#/scroll?s=${v.s}&n=${v.n}`}>{node.title}</a> : null}
          {isNew(v) ? <span className="tag tag-new">New</span> : null}
          {v.o ? <span className="tag tag-old" title={freshText(v, cat)}>May be outdated</span> : null}
          {done ? <span className="seen">Done</span> : s.positions[v.i] ? <span className="seen">Started</span> : null}
        </p>
        {extra}
      </div>
      <div className="row-side">
        <Vouch v={v} />
        <span className="acts">
          <button type="button" className={"act" + (saved ? " on" : "")} aria-pressed={saved} title={saved ? "Saved" : "Save"} aria-label={saved ? "Saved" : "Save"} onClick={() => toggleSave(v.i, saved)}><IconSave on={saved} /></button>
          <button type="button" className={"act" + (queued ? " on" : "")} aria-pressed={queued} title={queued ? "In queue" : "Queue"} aria-label={queued ? "In queue" : "Queue"} onClick={() => toggleQueue(v.i, queued)}><IconQueue /></button>
          <button type="button" className={"act" + (done ? " on" : "")} aria-pressed={done} title={done ? "Done" : "Mark done"} aria-label={done ? "Done" : "Mark done"} onClick={() => toggleDone(v.i, done)}><IconCheck /></button>
        </span>
      </div>
    </article>
  );
}

/* ---------- compact "up next" item with a small thumbnail ---------- */
export function NextItem({ v, cat, cur, after }: { v: Video; cat: Catalogue; cur?: boolean; after?: ReactNode }) {
  return (
    <li className={cur ? "cur" : ""}>
      <a href={`#/scroll/watch/${v.i}`}><Thumb v={v} cat={cat} /><span className="next-t">{v.t}<small>{v.c} · {LEVEL_NAME[v.l]}</small></span></a>
      {after}
    </li>
  );
}
