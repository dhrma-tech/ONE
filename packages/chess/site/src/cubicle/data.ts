// Cubicle catalogue: types, lazy loading of data/cubicle/*.json (see docs/cubicle-data.md) and small helpers.
// Text only: there are no thumbnail fields and the site never requests images from YouTube.

export type Level = "b" | "i" | "a" | "x";
export type Kind = "lesson" | "course" | "gameplay" | "review" | "tips" | "recap" | "talk";

export interface Video {
  i: string; t: string; c: string; h: string | null; n: string; s: string; l: Level; k: Kind;
  sc: number; f: number; o: 0 | 1; sr: number; src: string[]; tr: number; d: number | null; p: string | null;
}
export interface TNode { id: string; title: string; shelf: string; level: Level; keywords: string[]; practice?: string | null }
export interface Section { id: string; title: string; blurb?: string; floor?: number; nodes: TNode[] }
export interface Path { id: string; title: string; blurb?: string; level?: Level; videos: string[] }
export interface Meta { built?: string; videos?: number; channels?: number; keyless?: boolean; shortfalls?: string[] }

export interface Catalogue {
  videos: Video[]; latest: Video[]; sections: Section[]; paths: Path[]; meta: Meta;
  byId: Map<string, Video>; byNode: Map<string, Video[]>; bySection: Map<string, Video[]>;
  nodes: Map<string, TNode & { section: string }>; channels: string[];
}

export const LEVELS: Level[] = ["b", "i", "a", "x"];
export const LEVEL_NAME: Record<Level, string> = { b: "Beginner", i: "Intermediate", a: "Advanced", x: "Expert" };
export const LEVEL_RANGE: Record<Level, string> = { b: "under 1000", i: "1000–1600", a: "1600–2000", x: "2000+" };
export const KINDS: Kind[] = ["lesson", "course", "gameplay", "review", "tips", "recap", "talk"];
export const KIND_NAME: Record<Kind, string> = {
  lesson: "Lesson", course: "Course", gameplay: "Gameplay", review: "Game review", tips: "Tips", recap: "Recap", talk: "Talk",
};

const base = () => new URL("data/cubicle/", document.baseURI).href;
async function get<T>(file: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(base() + file);
    if (!r.ok) return fallback;
    return (await r.json()) as T;
  } catch { return fallback; }
}

let loading: Promise<Catalogue> | null = null;
export function loadCatalogue(): Promise<Catalogue> {
  loading ??= (async () => {
    const [tax, vids, lat, paths, meta] = await Promise.all([
      get<{ sections: Section[] }>("taxonomy.json", { sections: [] }),
      get<{ videos: Video[] }>("videos.json", { videos: [] }),
      get<{ items: Video[] }>("latest.json", { items: [] }),
      get<{ paths: Path[] }>("paths.json", { paths: [] }),
      get<Meta>("meta.json", {}),
    ]);
    const videos = [...(vids.videos ?? [])].sort((a, b) => b.sc - a.sc);
    const byId = new Map(videos.map((v) => [v.i, v]));
    const byNode = new Map<string, Video[]>(), bySection = new Map<string, Video[]>();
    for (const v of videos) {
      (byNode.get(v.n) ?? byNode.set(v.n, []).get(v.n)!).push(v);
      (bySection.get(v.s) ?? bySection.set(v.s, []).get(v.s)!).push(v);
    }
    const nodes = new Map<string, TNode & { section: string }>();
    for (const s of tax.sections ?? []) for (const n of s.nodes) nodes.set(n.id, { ...n, section: s.id });
    const latest = (lat.items ?? []).filter((v) => v && v.i);
    for (const v of latest) if (!byId.has(v.i)) byId.set(v.i, v);
    return {
      videos, latest, sections: tax.sections ?? [], paths: buildPaths(paths.paths ?? [], videos, byId), meta,
      byId, byNode, bySection, nodes, channels: [...new Set(videos.map((v) => v.c))].sort((a, b) => a.localeCompare(b)),
    };
  })();
  return loading;
}

/** Keep pipeline paths (only ids we actually have), and add rating-band paths when missing. */
function buildPaths(given: Path[], videos: Video[], byId: Map<string, Video>): Path[] {
  const out = given.filter((p) => p.id !== "repertoire") // the repertoire path was removed from Scroll
    .map((p) => ({ ...p, videos: p.videos.filter((id) => byId.has(id)) })).filter((p) => p.videos.length);
  const has = (id: string) => out.some((p) => p.id === id);
  const BAND: Record<Level, string> = { b: "0 to 1000", i: "1000 to 1600", a: "1600 to 2000", x: "2000 and up" };
  const order = ["start", "tactics", "calc", "strategy", "middlegame", "endgames", "improve", "analysis"];
  for (const l of LEVELS) {
    const id = `band-${l}`;
    if (has(id)) continue;
    const pick = videos.filter((v) => v.l === l && order.includes(v.s))
      .sort((a, b) => order.indexOf(a.s) - order.indexOf(b.s) || b.sc - a.sc);
    const perSection = new Map<string, number>();
    const vids = pick.filter((v) => { const n = perSection.get(v.s) ?? 0; perSection.set(v.s, n + 1); return n < 3; }).slice(0, 16);
    if (vids.length >= 3) out.push({ id, title: `Rated ${BAND[l]}`, blurb: `A track for players rated ${LEVEL_RANGE[l]}.`, level: l, videos: vids.map((v) => v.i) });
  }
  return out;
}

export function fmtDur(sec: number | null | undefined): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h} h ${m ? `${m} min` : ""}`.trim() : `${Math.max(1, m)} min`;
}
export const fmtClock = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? `${h}:${String(m).padStart(2, "0")}` : String(m)) + ":" + String(x).padStart(2, "0");
};
export const isNew = (v: Video) => !!v.p && Date.now() - Date.parse(v.p) < 30 * 86400000;

/** Bobby rating -> Cubicle level code (b < 1000, i 1000-1600, a 1600-2000, x 2000+). */
export const levelForRating = (r: number | null | undefined): Level => (r == null ? "b" : r < 1000 ? "b" : r < 1600 ? "i" : r < 2000 ? "a" : "x");
/** The level itself and its neighbours (the default "my level" filter). */
export const nearLevels = (l: Level): Level[] => { const i = LEVELS.indexOf(l); return LEVELS.filter((_, j) => Math.abs(j - i) <= 1); };
