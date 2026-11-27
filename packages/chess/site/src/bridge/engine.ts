// Engine layer (PLAN section 6). One interface, swappable adapters.
// StockfishAdapter: single-threaded lite WASM build in a Web Worker (no COOP/COEP headers needed).
// MaiaAdapter: stub behind the same interface (human-like play via ONNX, not implemented yet).
import type { Eval } from "./types";
import { SF_ELO_MAX, SF_ELO_MIN, WEAK, sampleHumanMove, weakPlayParams } from "./strength";
export { SF_ELO_MAX, SF_ELO_MIN, sampleHumanMove, weakPlayParams };


export interface EngineLine { pv: string[]; cp: number | null; mate: number | null }
export interface AnalyseOpts {
  depth?: number; multipv?: number; movetimeMs?: number;
  /** Superseding channel: a newer request on the same channel cancels older queued/running ones (they resolve empty). */
  channel?: string;
}
export interface BestMoveOpts { targetElo?: number | null; movetimeMs?: number }
export interface Engine {
  readonly name: string;
  available(): boolean;
  ready(): Promise<void>;
  setStrength(elo: number | null): void;
  /** Lines with scores from the side-to-move's view. */
  analyse(fen: string, opts?: AnalyseOpts): Promise<{ lines: EngineLine[]; depth: number }>;
  bestMove(fen: string, opts?: BestMoveOpts): Promise<{ uci: string }>;
  stop(): void;
  dispose(): void;
}

export function describeStrength(elo: number): string {
  if (elo >= SF_ELO_MIN) return `Bobby is playing about ${Math.round(elo)} (Stockfish limited strength).`;
  return `Bobby is playing about ${Math.round(elo)} (shallow search with human-like mistakes).`;
}

/** Convert a side-to-move score into a white-perspective Eval. */
export function toWhite(line: Pick<EngineLine, "cp" | "mate">, fen: string): Eval {
  const black = fen.split(" ")[1] === "b";
  const s = black ? -1 : 1;
  return { cp: line.cp === null ? null : line.cp * s, mate: line.mate === null ? null : line.mate * s };
}

export class StockfishAdapter implements Engine {
  readonly name = "stockfish";
  private w: Worker | null = null;
  private listeners = new Set<(l: string) => void>();
  private queue: Promise<void> = Promise.resolve();
  private boot: Promise<void> | null = null;
  private elo: number | null = null;
  private applied = "";

  constructor(private url = new URL("engine/stockfish-18-lite-single.js", document.baseURI).href) {}

  available() { return typeof Worker !== "undefined" && typeof WebAssembly !== "undefined"; }

  private send(cmd: string) { this.w!.postMessage(cmd); }
  private waitFor(pred: (l: string) => boolean, onLine?: (l: string) => void): Promise<string> {
    return new Promise((res) => {
      const f = (l: string) => { onLine?.(l); if (pred(l)) { this.listeners.delete(f); res(l); } };
      this.listeners.add(f);
    });
  }

  ready(): Promise<void> {
    if (this.boot) return this.boot;
    this.boot = (async () => {
      this.w = new Worker(this.url);
      this.w.onmessage = (e: MessageEvent) => { const l = String(e.data); this.listeners.forEach((f) => f(l)); };
      const ok = this.waitFor((l) => l === "uciok");
      this.send("uci"); await ok;
      this.send("setoption name Hash value 16");
      await this.isReady();
    })();
    return this.boot;
  }
  private async isReady() { const p = this.waitFor((l) => l === "readyok"); this.send("isready"); await p; }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.queue.then(() => this.ready()).then(fn);
    this.queue = p.then(() => undefined, () => undefined);
    return p;
  }

  setStrength(elo: number | null) { this.elo = elo; }

  private async applyOptions(key: string, opts: [string, string | number | boolean][]) {
    if (this.applied === key) return;
    for (const [n, v] of opts) this.send(`setoption name ${n} value ${v}`);
    this.applied = key;
    await this.isReady();
  }

  private async search(fen: string, go: string, multipv: number): Promise<{ lines: EngineLine[]; depth: number; best: string }> {
    const lines: EngineLine[] = [];
    let depth = 0;
    this.send(`position fen ${fen}`);
    const done = this.waitFor((l) => l.startsWith("bestmove"), (l) => {
      if (!l.startsWith("info ") || !l.includes(" pv ")) return;
      const t = l.split(" ");
      const get = (k: string) => { const i = t.indexOf(k); return i >= 0 ? t[i + 1] : undefined; };
      if (t.includes("lowerbound") || t.includes("upperbound")) return;
      const d = Number(get("depth") ?? 0);
      const k = Number(get("multipv") ?? 1) - 1;
      const si = t.indexOf("score");
      const kind = t[si + 1], val = Number(t[si + 2]);
      const pv = t.slice(t.indexOf("pv") + 1);
      if (k === 0 && d > depth) depth = d;
      lines[k] = { pv, cp: kind === "cp" ? val : null, mate: kind === "mate" ? val : null };
    });
    this.send(go);
    const bm = await done;
    const best = bm.split(" ")[1];
    return { lines: lines.filter(Boolean).slice(0, multipv), depth, best };
  }

  private channels = new Map<string, number>();
  private running: string | null = null;

  analyse(fen: string, opts: AnalyseOpts = {}) {
    const multipv = Math.max(1, Math.min(5, opts.multipv ?? 1));
    const ch = opts.channel;
    const ticket = ch ? (this.channels.get(ch) ?? 0) + 1 : 0;
    if (ch) { this.channels.set(ch, ticket); if (this.running === ch) this.stop(); }
    return this.run(async () => {
      if (ch && this.channels.get(ch) !== ticket) return { lines: [], depth: 0 };
      this.running = ch ?? null;
      await this.applyOptions(`full:${multipv}`, [["UCI_LimitStrength", false], ["Skill Level", 20], ["MultiPV", multipv]]);
      const go = opts.movetimeMs && !opts.depth ? `go movetime ${opts.movetimeMs}` : `go depth ${opts.depth ?? 14}${opts.movetimeMs ? ` movetime ${opts.movetimeMs}` : ""}`;
      const r = await this.search(fen, go, multipv).finally(() => { this.running = null; });
      if (ch && this.channels.get(ch) !== ticket) return { lines: [], depth: 0 };
      if (!r.lines.length && r.best && r.best !== "(none)") r.lines.push({ pv: [r.best], cp: 0, mate: null });
      return { lines: r.lines, depth: r.depth };
    });
  }

  bestMove(fen: string, opts: BestMoveOpts = {}) {
    const elo = opts.targetElo ?? this.elo;
    const movetime = opts.movetimeMs ?? 600;
    return this.run(async () => {
      if (elo === null || elo === undefined || elo >= SF_ELO_MAX) {
        await this.applyOptions("max", [["UCI_LimitStrength", false], ["Skill Level", 20], ["MultiPV", 1]]);
        return { uci: (await this.search(fen, `go movetime ${movetime}`, 1)).best };
      }
      if (elo >= SF_ELO_MIN) {
        await this.applyOptions(`elo:${Math.round(elo)}`, [["MultiPV", 1], ["Skill Level", 20], ["UCI_LimitStrength", true], ["UCI_Elo", Math.round(elo)]]);
        return { uci: (await this.search(fen, `go movetime ${movetime}`, 1)).best };
      }
      const p = weakPlayParams(elo);
      await this.applyOptions(`weak:${p.skill}:${p.multipv}`, [["UCI_LimitStrength", false], ["Skill Level", p.skill], ["MultiPV", p.multipv]]);
      const r = await this.search(fen, `go depth ${p.depth} movetime ${Math.min(movetime, WEAK.maxMovetimeMs)}`, p.multipv);
      return { uci: sampleHumanMove(r.lines, p.temperatureCp, p.blunderProb) ?? r.best };
    });
  }

  stop() { if (this.w) this.send("stop"); }
  dispose() { this.w?.terminate(); this.w = null; this.boot = null; this.applied = ""; this.listeners.clear(); }
}

/** Maia (human-like) adapter. STUB, see docs/MAIA.md (feasibility notes: Maia-3 ONNX loads in onnxruntime-web; move vocabulary
 *  mapping and AGPL-3.0 licensing still to settle).
 *  `available()` returns false so callers fall back to Stockfish. */
export class MaiaAdapter implements Engine {
  readonly name = "maia";
  available() { return false; }
  ready(): Promise<void> { return Promise.reject(new Error("MaiaAdapter not implemented")); }
  setStrength(_elo: number | null) { /* Maia picks a model per rating band */ }
  analyse(_fen: string, _opts?: AnalyseOpts): Promise<{ lines: EngineLine[]; depth: number }> { return Promise.reject(new Error("MaiaAdapter not implemented")); }
  bestMove(_fen: string, _opts?: BestMoveOpts): Promise<{ uci: string }> { return Promise.reject(new Error("MaiaAdapter not implemented")); }
  stop() {}
  dispose() {}
}

// Shared instances: one engine plays, one analyses, so the eval bar never delays Bobby's move.
let play: Engine | null = null;
let analysis: StockfishAdapter | null = null;
const maia = new MaiaAdapter();
export function playEngine(): Engine { return (play ??= maia.available() ? maia : new StockfishAdapter()); }
export function analysisEngine(): StockfishAdapter { return (analysis ??= new StockfishAdapter()); }
