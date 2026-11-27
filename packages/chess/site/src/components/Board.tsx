import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Square } from "chess.js";
import type { BoardTheme, PieceSet } from "../bridge/storage";
import { kingSquare } from "../lib/chess";

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }> = {
  green: { light: "#eeeed2", dark: "#6f9a6a", label: "Green" },
  brown: { light: "#f0d9b5", dark: "#b58863", label: "Wood" },
  blue: { light: "#dee3e6", dark: "#8ca2ad", label: "Slate" },
  gray: { light: "#e6e6e6", dark: "#9a9a9a", label: "Stone" },
};

export interface BoardProps {
  fen: string;
  orientation: "white" | "black";
  /** Which side may move pieces: "w", "b", "both" or "none". */
  movable: "w" | "b" | "both" | "none";
  onMove?: (from: string, to: string, promotion?: string) => boolean;
  lastMove?: [string, string] | null;
  highlight?: string | null; // hint: piece square
  arrows?: [string, string, string?][];
  theme: BoardTheme;
  coordinates: boolean;
  legalHighlights: boolean;
  label?: string;
  pieceSet?: PieceSet;
  /** Square-click mode (lessons): called for every clicked square; pieces are not moved. */
  onSquare?: (sq: string) => void;
  /** Extra square tints, e.g. lesson feedback. */
  marks?: Record<string, string>;
}

const GLYPH: Record<string, string> = { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" };
type PieceRenderer = (a: { squareWidth: number }) => JSX.Element;
const piecesCache = new Map<PieceSet, Record<string, PieceRenderer>>();
function customPieces(set: PieceSet | undefined): Record<string, PieceRenderer> | undefined {
  if (!set || set === "classic") return undefined;
  const hit = piecesCache.get(set); if (hit) return hit;
  const out: Record<string, PieceRenderer> = {};
  for (const c of ["w", "b"]) for (const t of "KQRBNP") {
    const white = c === "w";
    out[c + t] = ({ squareWidth }) => (
      <div className={"pc pc-" + set} style={{ width: squareWidth, height: squareWidth, fontSize: squareWidth * (set === "glyph" ? 0.78 : 0.5), color: white ? "#fff" : "#111", WebkitTextStroke: white ? "1.2px #222" : "0", textShadow: white ? "0 1px 2px rgba(0,0,0,.35)" : "none" }}>
        {set === "glyph" ? GLYPH[t] : <span className={"pc-l" + (white ? " w" : " b")}>{t}</span>}
      </div>
    );
  }
  piecesCache.set(set, out);
  return out;
}

function BoardImpl(p: BoardProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [sel, setSel] = useState<string | null>(null);
  const chess = useMemo(() => { try { return new Chess(p.fen); } catch { return null; } }, [p.fen]);
  useEffect(() => setSel(null), [p.fen]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const canMove = (color: "w" | "b") => p.movable === "both" || p.movable === color;
  const targets = useMemo(() => (sel && chess ? chess.moves({ square: sel as Square, verbose: true }).map((m) => m.to as string) : []), [sel, chess]);

  const styles = useMemo(() => {
    const s: Record<string, Record<string, string>> = {};
    const tint = (sq: string, bg: string) => { s[sq] = { ...(s[sq] ?? {}), background: bg }; };
    if (p.lastMove) { tint(p.lastMove[0], "rgba(232,163,23,.38)"); tint(p.lastMove[1], "rgba(232,163,23,.48)"); }
    if (chess?.inCheck()) { const k = kingSquare(chess, chess.turn()); if (k) tint(k, "radial-gradient(circle, rgba(220,38,38,.85) 0%, rgba(220,38,38,.35) 55%, transparent 75%)"); }
    if (p.highlight) tint(p.highlight, "rgba(31,107,87,.55)");
    if (sel) tint(sel, "rgba(31,107,87,.45)");
    for (const [sq, bg] of Object.entries(p.marks ?? {})) tint(sq, bg);
    if (p.legalHighlights) for (const t of targets) {
      const occupied = chess?.get(t as Square);
      s[t] = { ...(s[t] ?? {}), backgroundImage: occupied ? "radial-gradient(circle, transparent 58%, rgba(0,0,0,.28) 60%)" : "radial-gradient(circle, rgba(0,0,0,.24) 18%, transparent 20%)" };
    }
    return s;
  }, [p.lastMove, p.highlight, p.legalHighlights, sel, targets, chess, p.marks]);

  const attempt = (from: string, to: string, promo?: string) => (p.onMove ? p.onMove(from, to, promo) : false);

  const onSquareClick = (sq: Square) => {
    if (p.onSquare) { p.onSquare(sq); return; }
    if (!chess || p.movable === "none") return;
    const pc = chess.get(sq);
    if (sel && targets.includes(sq)) {
      const promo = chess.moves({ square: sel as Square, verbose: true }).some((m) => m.to === sq && m.promotion) ? "q" : undefined;
      attempt(sel, sq, promo); setSel(null); return;
    }
    if (pc && pc.color === chess.turn() && canMove(pc.color)) setSel(sq === sel ? null : sq); else setSel(null);
  };

  const th = BOARD_THEMES[p.theme] ?? BOARD_THEMES.green;
  return (
    <div className="board" ref={wrap} role="application" aria-label={p.label ?? "Chess board"} aria-roledescription="chess board">
      <Chessboard
        id="bobby-board"
        position={p.fen}
        boardWidth={width}
        boardOrientation={p.orientation}
        showBoardNotation={p.coordinates}
        animationDuration={160}
        arePremovesAllowed={false}
        arePiecesDraggable={p.movable !== "none"}
        isDraggablePiece={({ piece }) => !!chess && piece[0] === chess.turn() && canMove(piece[0] as "w" | "b")}
        onPieceDragBegin={(_pc, sq) => setSel(sq)}
        onPieceDrop={(from, to, piece) => {
          setSel(null);
          const promo = piece[1]?.toLowerCase();
          const isPromo = chess?.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
          return attempt(from, to, isPromo ? (promo && "qrbn".includes(promo) ? promo : "q") : undefined);
        }}
        onSquareClick={onSquareClick}
        customSquareStyles={styles}
        customPieces={customPieces(p.pieceSet)}
        customArrows={(p.arrows ?? []).map(([a, b, c]) => [a as Square, b as Square, c ?? "rgba(31,107,87,.8)"])}
        customLightSquareStyle={{ backgroundColor: th.light }}
        customDarkSquareStyle={{ backgroundColor: th.dark }}
        customBoardStyle={{ borderRadius: "10px", overflow: "hidden" }}
      />
    </div>
  );
}
export const Board = memo(BoardImpl);
