// Drop-in replacement for <select> that matches the app's look (rounded trigger, floating popover like the search box).
// Takes the same <option value>label</option> children and calls onChange with a select-like { target: { value } } object,
// so call sites only swap the tag name.
import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Opt { value: string; label: string; disabled?: boolean }
interface Props {
  value: string | number; onChange: (e: { target: { value: string } }) => void; children: ReactNode;
  "aria-label"?: string; className?: string; disabled?: boolean;
}

function textOf(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(n)) return textOf(n.props.children);
  return "";
}

function optionsOf(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(c)) return;
    if (c.type === "option") out.push({ value: String(c.props.value ?? textOf(c.props.children)), label: textOf(c.props.children), disabled: c.props.disabled });
    else out.push(...optionsOf(c.props.children));
  });
  return out;
}

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);
const Tick = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export function Select({ value, onChange, children, className, disabled, ...rest }: Props) {
  const opts = optionsOf(children);
  const cur = String(value);
  const selIdx = Math.max(0, opts.findIndex((o) => o.value === cur));
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(selIdx);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ s: "", t: 0 });
  const id = useId();

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 220 && above > below;
    const width = Math.max(r.width, 180);
    const left = Math.min(r.left, innerWidth - width - 8);
    setPos(up ? { left, bottom: innerHeight - r.top + 6, width, maxH: Math.min(340, above) } : { left, top: r.bottom + 6, width, maxH: Math.min(340, below) });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!btn.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node)) setOpen(false); };
    // Follow the trigger when the page or a dialog scrolls (scrolling inside the list itself is ignored).
    const follow = (e: Event) => { if (!list.current?.contains(e.target as Node)) place(); };
    addEventListener("mousedown", down); addEventListener("scroll", follow, true); addEventListener("resize", follow);
    return () => { removeEventListener("mousedown", down); removeEventListener("scroll", follow, true); removeEventListener("resize", follow); };
  }, [open]);
  // Keep the active option visible by scrolling the list only (scrollIntoView would also scroll the page or dialog).
  useEffect(() => {
    const l = list.current, el = l?.querySelector<HTMLElement>(`[data-i="${act}"]`);
    if (!l || !el) return;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop - 6;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight + 6;
  }, [open, act, pos]);

  const show = () => { if (disabled) return; setAct(selIdx); setOpen(true); };
  const choose = (i: number) => {
    const o = opts[i];
    if (!o || o.disabled) return;
    setOpen(false); btn.current?.focus();
    if (o.value !== cur) onChange({ target: { value: o.value } });
  };
  const move = (d: number) => setAct((a) => {
    for (let i = a + d; i >= 0 && i < opts.length; i += d) if (!opts[i].disabled) return i;
    return a;
  });

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (!open) {
      if (k === "ArrowDown" || k === "ArrowUp" || k === "Enter" || k === " ") { e.preventDefault(); show(); }
      return;
    }
    if (k === "Escape" || k === "Tab") { if (k === "Escape") { e.preventDefault(); e.stopPropagation(); } setOpen(false); }
    else if (k === "ArrowDown") { e.preventDefault(); move(1); }
    else if (k === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (k === "Home") { e.preventDefault(); setAct(0); }
    else if (k === "End") { e.preventDefault(); setAct(opts.length - 1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); choose(act); }
    else if (k.length === 1) {
      const now = Date.now();
      typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : "") + k.toLowerCase(), t: now };
      const i = opts.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.s));
      if (i >= 0) setAct(i);
    }
  };

  return (
    <>
      <button ref={btn} type="button" className={"select-btn" + (open ? " open" : "") + (className ? " " + className : "")} disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${act}` : undefined} data-value={cur} aria-label={rest["aria-label"]}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}>
        <span className="select-v">{opts[selIdx]?.label ?? ""}</span><Chevron />
      </button>
      {open && pos ? createPortal(
        <ul ref={list} id={id} role="listbox" aria-label={rest["aria-label"]} className={"select-pop" + (pos.bottom !== undefined ? " up" : "")}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxH }}>
          {opts.map((o, i) => (
            <li key={o.value + i} id={`${id}-${i}`} data-i={i} data-value={o.value} role="option" aria-selected={o.value === cur} aria-disabled={o.disabled || undefined}
              className={"select-o" + (i === act ? " on" : "") + (o.value === cur ? " sel" : "")}
              onMouseMove={() => setAct(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              <span>{o.label}</span>{o.value === cur ? <Tick /> : null}
            </li>
          ))}
        </ul>, document.body) : null}
    </>
  );
}
