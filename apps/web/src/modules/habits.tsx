// Recurring habits editor (daily structure). Generates tasks on matching weekdays.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import { Button, Chip, IconButton, Input } from "@/ui";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function HabitsEditor({ section }: { section: string }) {
  const habits = useLiveQuery(async () => (await db.t("habits").toArray()).filter((h) => !h.deleted_at && h.section === section).sort((a, b) => a.order_no - b.order_no), [section]);
  const [title, setTitle] = useState("");
  return (
    <div className="stack">
      <ul className="list">
        {(habits ?? []).map((h) => (
          <li key={h.id} style={{ flexWrap: "wrap", opacity: h.active ? 1 : 0.5 }}>
            <input type="checkbox" className="checkbox" checked={h.active} onChange={(e) => void repo.patch("habits", h.id, { active: e.target.checked })} aria-label={`${h.title} active`} />
            <span className="small grow" style={{ minWidth: 160 }}>{h.title}</span>
            <input type="time" className="input" style={{ width: 124, minHeight: 32 }} value={h.time ?? ""} onChange={(e) => void repo.patch("habits", h.id, { time: e.target.value || null })} aria-label={`${h.title} time`} />
            <span className="row" style={{ gap: 2 }}>
              {DAYS.map((d, i) => (
                <Chip key={i} on={h.days.includes(i)} onClick={() => void repo.patch("habits", h.id, { days: h.days.includes(i) ? h.days.filter((x) => x !== i) : [...h.days, i].sort() })} title={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}>
                  {d}
                </Chip>
              ))}
            </span>
            <Chip on={h.calendar} onClick={() => void repo.patch("habits", h.id, { calendar: !h.calendar })} title="Push to the ONE calendar">
              cal
            </Chip>
            <IconButton icon="trash" size="sm" label="Delete habit" onClick={() => void repo.remove("habits", h.id)} />
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void repo.insert("habits", { section, title: title.trim(), order_no: (habits?.at(-1)?.order_no ?? 0) + 1 });
          setTitle("");
        }}
      >
        <Input aria-label="New habit" placeholder="New daily habit…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" icon="plus">Add</Button>
      </form>
    </div>
  );
}
