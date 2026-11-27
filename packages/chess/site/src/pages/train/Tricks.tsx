// Tricks library: knowledge cards, each with an interactive example (a matching themed puzzle) and a lesson link.
import { useEffect, useMemo, useState } from "react";
import { PuzzlePlayer } from "../../components/PuzzlePlayer";
import type { Puzzle } from "../../bridge/types";
import { data, lessonForTag, TAG_THEME, type KnowledgeCard } from "../../lib/data";
import { markActivity } from "../../lib/progress";
import { themedQueue, markSeen } from "./Puzzles";
import { useRoute } from "../../lib/router";

const GROUPS: [string, string[]][] = [
  ["All", []], ["Tactics", ["tactic", "fork", "pin", "skewer", "discovered", "double_check", "deflection", "decoy", "x_ray", "zwischenzug", "removing_defender", "overloaded", "trapped_piece"]],
  ["Mates", ["mate_pattern", "back_rank", "mate_threat", "check", "perpetual_check"]], ["Openings", ["opening", "opening_principle", "development", "castling", "queen_early", "tempo"]],
  ["Endgames", ["endgame", "endgame_k_p", "endgame_rook", "opposition", "rule_of_square", "lucena", "philidor", "passed_pawn", "king_activity", "zugzwang", "wrong_bishop", "active_rook", "rook_behind_pawn"]],
  ["Habits", ["habit", "beginner_mistake", "hanging_piece", "greed", "time_trouble", "calculation", "defence", "king_safety", "strategy"]],
];

export function Tricks() {
  const [cards, setCards] = useState<KnowledgeCard[] | null>(null);
  const [group, setGroup] = useState("All");
  const [sel, setSel] = useState<KnowledgeCard | null>(null);
  const [ex, setEx] = useState<{ q: Puzzle[]; i: number } | null>(null);
  const [exErr, setExErr] = useState("");
  const cardParam = useRoute().q.get("card");
  useEffect(() => { data.cards().then(setCards).catch(() => setCards([])); }, []);
  // Deep link from the top search bar: #/train?tab=tricks&card=<id>
  useEffect(() => { const c = cards?.find((x) => x.id === cardParam); if (c) { setGroup("All"); setSel(c); setEx(null); setExErr(""); } }, [cards, cardParam]);
  const shown = useMemo(() => {
    const tags = GROUPS.find(([g]) => g === group)?.[1] ?? [];
    return (cards ?? []).filter((c) => !tags.length || c.tags.some((t) => tags.includes(t)));
  }, [cards, group]);
  const current = sel ?? shown[0] ?? null;
  const themeOf = (c: KnowledgeCard) => c.tags.map((t) => TAG_THEME[t]).find(Boolean) ?? null;
  const lessonOf = (c: KnowledgeCard) => c.tags.map((t) => lessonForTag(t)).find(Boolean) ?? null;

  const tryExample = async (c: KnowledgeCard) => {
    setExErr(""); setEx(null);
    const th = themeOf(c);
    if (!th) { setExErr("No interactive example for this card yet."); return; }
    try { const q = await themedQueue(th, 5); if (q.length) setEx({ q, i: 0 }); else setExErr("No example found near your rating."); }
    catch (e) { setExErr((e as Error).message); }
  };

  if (!cards) return <p className="muted">Loading tricks…</p>;
  return (
    <div className="tricks">
      <div className="btnrow" role="group" aria-label="Filter">{GROUPS.map(([g]) => <button key={g} className={"chip" + (g === group ? " on" : "")} onClick={() => setGroup(g)}>{g}</button>)}</div>
      <div className="tricks-grid">
        <ul className="cardlist">
          {shown.map((c) => (
            <li key={c.id}><button className={"kcard" + (current?.id === c.id ? " on" : "")} onClick={() => { setSel(c); setEx(null); setExErr(""); }}>
              <strong>{c.title}</strong><small className="muted">{c.text.slice(0, 90)}{c.text.length > 90 ? "…" : ""}</small></button></li>
          ))}
        </ul>
        <div className="kdetail">
          {current ? (
            <article>
              <h2>{current.title}</h2>
              <p>{current.text}</p>
              <p className="muted small">{current.tags.map((t) => t.replace(/_/g, " ")).join(" · ")}</p>
              <div className="btnrow">
                {themeOf(current) ? <button className="btn btn-primary" onClick={() => void tryExample(current)}>Try an example</button> : null}
                {lessonOf(current) ? <a className="btn" href={`#/learn?l=${lessonOf(current)}`}>Related lesson</a> : null}
              </div>
              {exErr ? <p className="muted small">{exErr}</p> : null}
              {ex ? <div className="trainer"><PuzzlePlayer puzzle={ex.q[ex.i % ex.q.length]} onDone={(r) => { void markSeen(ex.q[ex.i % ex.q.length].id); void markActivity(r.solved ? "puzzles_solved" : undefined); }} onNext={() => setEx({ ...ex, i: ex.i + 1 })} label={`Example: ${current.title}`} /></div> : null}
            </article>
          ) : <p className="muted">Pick a card to read it and try an example on the board.</p>}
        </div>
      </div>
    </div>
  );
}
