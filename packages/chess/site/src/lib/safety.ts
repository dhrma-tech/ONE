// Safety net: before a move is played, check (instantly, no engine) whether it hangs a piece or allows mate in one.
// Only problems the move itself creates are reported; pieces that were already in trouble are left alone.
import { Chess, type Color, type Square } from "chess.js";

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
const ATTACKER: Record<string, string> = { p: "a pawn", n: "a knight", b: "a bishop", r: "a rook", q: "the queen", k: "the king" };

export interface SafetyWarning { text: string; squares: string[]; arrow: [string, string] | null }

/** Squares of `me`'s pieces (not the king) that the opponent could win: undefended, or attacked by something cheaper. */
function hanging(c: Chess, me: Color): Map<string, { attacker: Square; cheapest: string }> {
  const opp: Color = me === "w" ? "b" : "w";
  const out = new Map<string, { attacker: Square; cheapest: string }>();
  for (const row of c.board()) for (const p of row) {
    if (!p || p.color !== me || p.type === "k") continue;
    const att = c.attackers(p.square, opp);
    if (!att.length) continue;
    const cheapest = att.reduce((a, b) => (VALUE[c.get(b)?.type ?? "q"] < VALUE[c.get(a)?.type ?? "q"] ? b : a));
    const ct = c.get(cheapest)?.type ?? "q";
    if (!c.attackers(p.square, me).length || VALUE[ct] < VALUE[p.type]) out.set(p.square, { attacker: cheapest, cheapest: ct });
  }
  return out;
}

export function safetyCheck(fen: string, from: string, to: string, promotion?: string): SafetyWarning | null {
  const before = new Chess(fen);
  const me = before.turn();
  let mv;
  try { mv = before.move({ from, to, promotion: promotion ?? "q" }); } catch { return null; }
  if (!mv || before.isCheckmate() || before.isDraw()) return null;
  const after = before; // the move is applied
  // 1) mate in one for the opponent
  for (const m of after.moves({ verbose: true })) {
    const c2 = new Chess(after.fen());
    c2.move(m.san);
    if (c2.isCheckmate()) return { text: `This lets them checkmate you with ${m.san}.`, squares: [m.to], arrow: [m.from, m.to] };
  }
  // 2) a piece left hanging by this move (newly hanging, or the moved piece itself)
  const prev = hanging(new Chess(fen), me);
  const now = hanging(after, me);
  const gained = VALUE[mv.captured ?? ""] ?? 0;
  for (const [sq, h] of now) {
    const p = after.get(sq as Square);
    if (!p || (prev.has(sq) && sq !== mv.to)) continue;
    if (gained >= VALUE[p.type]) continue; // a fair trade, not a blunder
    const free = !after.attackers(sq as Square, me).length;
    return {
      text: `Your ${NAME[p.type]} on ${sq} can be taken${free ? " for free" : ` by ${ATTACKER[h.cheapest]}`}.`,
      squares: [sq], arrow: [h.attacker, sq],
    };
  }
  return null;
}
