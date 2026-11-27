// Train: Puzzles, Endgames, Openings, Tricks, Challenges (tab in the query string: #/train?tab=endgames).
import { Puzzles } from "./train/Puzzles";
import { Endgames } from "./train/Endgames";
import { Openings } from "./train/Openings";
import { Tricks } from "./train/Tricks";
import { Challenges } from "./train/Challenges";
import { go, useRoute } from "../lib/router";

const TABS = [["puzzles", "Puzzles"], ["endgames", "Endgames"], ["openings", "Openings"], ["tricks", "Tricks"], ["challenges", "Challenges"]] as const;
type Tab = (typeof TABS)[number][0];

export function Train() {
  const route = useRoute();
  const t = (TABS.find(([id]) => id === route.q.get("tab"))?.[0] ?? "puzzles") as Tab;
  return (
    <div className="page train">
      <header className="page-h row">
        <h1>Train</h1>
        <div className="tabs" role="tablist" aria-label="Training">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" id={"tab-" + id} aria-selected={t === id} aria-controls="tabpanel" className={"tab" + (t === id ? " on" : "")} onClick={() => go(`/train?tab=${id}`)}>{label}</button>
          ))}
        </div>
      </header>
      <div id="tabpanel" role="tabpanel" aria-labelledby={"tab-" + t}>
        {t === "puzzles" ? <Puzzles /> : t === "endgames" ? <Endgames /> : t === "openings" ? <Openings /> : t === "tricks" ? <Tricks /> : <Challenges />}
      </div>
    </div>
  );
}
