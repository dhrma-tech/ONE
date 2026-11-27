import { useEffect, useMemo, useRef, useState } from "react";
import type { Cmd } from "../lib/commands";

export function Palette({ cmds, onClose }: { cmds: Cmd[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return cmds.filter((c) => words.every((w) => (c.label + " " + (c.hint ?? "")).toLowerCase().includes(w)));
  }, [q, cmds]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { document.querySelector(".pal-i.on")?.scrollIntoView({ block: "nearest" }); }, [sel]);
  const run = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  return (
    <div className="dialog-wrap pal-wrap" role="presentation" onClick={onClose}>
      <div className="pal" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
          else if (e.key === "Enter") { e.preventDefault(); run(list[sel]); }
          else if (e.key === "Escape") { e.preventDefault(); onClose(); }
        }}>
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a command or page" aria-label="Search commands"
          role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={list[sel] ? "pal-" + list[sel].id : undefined} />
        <ul role="listbox" id="pal-list">
          {list.map((c, i) => (
            <li key={c.id} id={"pal-" + c.id} role="option" aria-selected={i === sel} className={"pal-i" + (i === sel ? " on" : "")} onMouseMove={() => setSel(i)} onClick={() => run(c)}>
              <span>{c.label}</span><small>{c.keys ? <kbd>{c.keys}</kbd> : c.hint}</small>
            </li>
          ))}
          {!list.length ? <li className="pal-empty">No matches</li> : null}
        </ul>
      </div>
    </div>
  );
}
