#!/usr/bin/env node
// Measure Bobby's approximate playing strength below Stockfish's UCI_Elo floor.
// Plays Bobby (using the exact constants + sampler from src/bridge/strength.ts) against Stockfish with
// UCI_LimitStrength at fixed anchor ratings, then converts the score to a performance rating:
//   perf = anchor + 400 * log10(s / (1 - s))   (s clamped to [0.05, 0.95])
// Both sides run the same single-threaded Stockfish 18 lite WASM build the browser uses (node_modules/stockfish).
//
//   node scripts/calibrate-strength.mjs --targets 400,800,1200 --anchors 1320 --games 8 --movetime 100
//
// Caveats: Stockfish's UCI_Elo is calibrated at 60s+0.6s against CCRL-like pools, not human Lichess ratings,
// and short movetimes shift it. Small game counts give wide error bars (+-150 or more at 8 games). Treat the
// output as a sanity check for monotonic, roughly-right strength, not a precise rating.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { SF_ELO_MIN, SF_ELO_MAX, WEAK, sampleHumanMove, weakPlayParams } from "../src/bridge/strength.ts";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE = join(site, "node_modules/stockfish/bin/stockfish-18-lite-single.js");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const TARGETS = arg("targets", "400,800,1200").split(",").map(Number);
const ANCHORS = arg("anchors", String(SF_ELO_MIN)).split(",").map(Number);
const GAMES = Number(arg("games", "8"));
const MOVETIME = Number(arg("movetime", "100"));
const MAX_PLIES = Number(arg("maxplies", "160"));

class Uci {
  constructor() {
    this.p = spawn(process.execPath, [ENGINE], { stdio: ["pipe", "pipe", "ignore"] });
    this.buf = ""; this.waiters = [];
    this.p.stdout.on("data", (d) => {
      this.buf += d; let i;
      while ((i = this.buf.indexOf("\n")) >= 0) { const l = this.buf.slice(0, i).trim(); if (process.env.UCI_DEBUG) console.error("<", l.slice(0, 100)); this.buf = this.buf.slice(i + 1); for (const w of [...this.waiters]) w(l); }
    });
    this.applied = "";
  }
  send(c) { if (process.env.UCI_DEBUG) console.error(">", c); this.p.stdin.write(c + "\n"); }
  until(pred, onLine) { return new Promise((res) => { const w = (l) => { onLine?.(l); if (pred(l)) { this.waiters = this.waiters.filter((x) => x !== w); res(l); } }; this.waiters.push(w); }); }
  async init() {
    // The WASM build ignores stdin until it has loaded, so repeat "uci" until it answers.
    const ok = this.until((l) => l === "uciok");
    this.send("uci"); const t = setInterval(() => this.send("uci"), 500);
    await ok; clearInterval(t); this.send("setoption name Hash value 16"); await this.ready(); }
  async ready() { const r = this.until((l) => l === "readyok"); this.send("isready"); await r; }
  async opts(key, list) { if (this.applied === key) return; for (const [n, v] of list) this.send(`setoption name ${n} value ${v}`); this.applied = key; await this.ready(); }
  async search(fen, go, multipv) {
    const lines = [];
    this.send(`position fen ${fen}`);
    const bmP = this.until((l) => l.startsWith("bestmove"), (l) => {
      if (!l.startsWith("info ") || !l.includes(" pv ") || l.includes("bound")) return;
      const t = l.split(" "); const g = (k) => t[t.indexOf(k) + 1];
      const k = Number(t.includes("multipv") ? g("multipv") : 1) - 1; const si = t.indexOf("score");
      lines[k] = { pv: t.slice(t.indexOf("pv") + 1), cp: t[si + 1] === "cp" ? Number(t[si + 2]) : null, mate: t[si + 1] === "mate" ? Number(t[si + 2]) : null };
    });
    this.send(go);
    const bm = await bmP;
    return { best: bm.split(" ")[1], lines: lines.filter(Boolean).slice(0, multipv) };
  }
  quit() { try { this.send("quit"); } catch { /* gone */ } setTimeout(() => this.p.kill(), 200); }
}

/** Bobby's move at a target rating: same branches as StockfishAdapter.bestMove in src/bridge/engine.ts. */
async function bobbyMove(e, fen, elo) {
  if (elo >= SF_ELO_MAX) { await e.opts("max", [["UCI_LimitStrength", false], ["Skill Level", 20], ["MultiPV", 1]]); return (await e.search(fen, `go movetime ${MOVETIME}`, 1)).best; }
  if (elo >= SF_ELO_MIN) { await e.opts(`elo:${elo}`, [["MultiPV", 1], ["Skill Level", 20], ["UCI_LimitStrength", true], ["UCI_Elo", elo]]); return (await e.search(fen, `go movetime ${MOVETIME}`, 1)).best; }
  const p = weakPlayParams(elo);
  await e.opts(`weak:${p.skill}:${p.multipv}`, [["UCI_LimitStrength", false], ["Skill Level", p.skill], ["MultiPV", p.multipv]]);
  const r = await e.search(fen, `go depth ${p.depth} movetime ${Math.min(MOVETIME * 4, WEAK.maxMovetimeMs)}`, p.multipv);
  return sampleHumanMove(r.lines, p.temperatureCp, p.blunderProb) ?? r.best;
}
async function anchorMove(e, fen, elo) {
  await e.opts(`elo:${elo}`, [["MultiPV", 1], ["Skill Level", 20], ["UCI_LimitStrength", true], ["UCI_Elo", elo]]);
  return (await e.search(fen, `go movetime ${MOVETIME}`, 1)).best;
}

async function game(bot, anc, target, anchor, bobbyWhite) {
  // anchor: number = Stockfish UCI_Elo; {bobby: elo} = Bobby at another target (for chaining below 1320).
  const c = new Chess();
  while (!c.isGameOver() && c.history().length < MAX_PLIES) {
    const bobbyToMove = (c.turn() === "w") === bobbyWhite;
    const u = bobbyToMove ? await bobbyMove(bot, c.fen(), target)
      : typeof anchor === "number" ? await anchorMove(anc, c.fen(), anchor) : await bobbyMove(anc, c.fen(), anchor.bobby);
    if (!u || u === "(none)") break;
    c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  }
  if (process.env.CAL_VERBOSE) console.error(`\n[${target} as ${bobbyWhite ? "W" : "B"}] ${c.history().length} plies, ${c.isCheckmate() ? "mate" : c.isGameOver() ? "draw" : "cap"}: ${c.history().slice(0, 30).join(" ")}`);
  if (c.isCheckmate()) return (c.turn() === "w") !== bobbyWhite ? 1 : 0;
  if (c.isGameOver() || c.history().length >= MAX_PLIES) {
    if (!c.isGameOver()) { // adjudicate unfinished games by material
      const v = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      let m = 0; for (const row of c.board()) for (const x of row) if (x) m += (x.color === "w" ? 1 : -1) * v[x.type];
      if (Math.abs(m) >= 3) return (m > 0) === bobbyWhite ? 1 : 0;
    }
    return 0.5;
  }
  return 0.5;
}

const bot = new Uci(), anc = new Uci();
await Promise.all([bot.init(), anc.init()]);
const t0 = Date.now();
const rows = [];
const perfOf = (score, n, base) => { const x = Math.min(0.95, Math.max(0.05, score / n)); return Math.round(base + 400 * Math.log10(x / (1 - x))); };
async function match(target, anchor, base, label) {
  let score = 0;
  for (let i = 0; i < GAMES; i++) { score += await game(bot, anc, target, anchor, i % 2 === 0); process.stdout.write("."); }
  const perf = perfOf(score, GAMES, base);
  const bound = score === 0 || score === GAMES;
  rows.push({ target, vs: label, games: GAMES, score, perf, bound });
  process.stdout.write(` Bobby@${target} vs ${label}: ${score}/${GAMES} -> perf ~${perf}${bound ? " (bound only)" : ""}\n`);
  return perf;
}
// 1) Every target against the Stockfish anchors.
for (const target of TARGETS) for (const anchor of ANCHORS) await match(target, anchor, anchor, `SF UCI_Elo ${anchor}`);
// 2) Chain: each lower target against the next higher target, using that target's measured perf vs the first anchor.
if (!process.argv.includes("--no-chain")) {
  const sorted = [...TARGETS].sort((a, b) => b - a);
  let base = rows.find((r) => r.target === sorted[0] && r.vs === `SF UCI_Elo ${ANCHORS[0]}`)?.perf ?? sorted[0];
  for (let i = 1; i < sorted.length; i++) base = await match(sorted[i], { bobby: sorted[i - 1] }, base, `Bobby@${sorted[i - 1]} (~${base})`);
}
bot.quit(); anc.quit();
console.log(`\nmovetime ${MOVETIME} ms, ${((Date.now() - t0) / 1000).toFixed(0)} s total`);
console.log(JSON.stringify(rows));
