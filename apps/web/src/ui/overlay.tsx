import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { IconButton } from "./primitives";
import { Icon } from "./icons";

function useEscape(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [open, onClose]);
}

/** Traps focus loosely: focuses the first focusable element on open and restores focus on close. */
function useFocusReturn(open: boolean, ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close]), [href], [tabindex]");
    (first ?? el)?.focus();
    return () => prev?.focus?.();
  }, [open, ref]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useFocusReturn(open, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="modal-head">
          <h3>{title}</h3>
          <IconButton icon="x" label="Close" onClick={onClose} data-close />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useFocusReturn(open, ref);
  if (!open) return null;
  return createPortal(
    <div className="overlay sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <div className="modal-head">
          <h3>{title}</h3>
          <IconButton icon="x" label="Close" onClick={onClose} data-close />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface TabDef {
  id: string;
  label: string;
  locked?: boolean;
}

/** Route tabs (each tab is a link to `${base}/${id}`). */
export function RouteTabs({ base, tabs, label }: { base: string; tabs: TabDef[]; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => (
        <NavLink key={t.id} to={`${base}/${t.id}`} className="tab">
          {t.label}
          {t.locked ? <Icon name="lock" size={10} className="lock" /> : null}
        </NavLink>
      ))}
    </nav>
  );
}

/** In-page tabs controlled by state. */
export function Tabs({ tabs, value, onChange, label }: { tabs: TabDef[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" className="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Segmented control, e.g. week / month / year. */
export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Prev / next pager. Lists in ONE always end. */
export function Pager({ page, pages, onPage, total }: { page: number; pages: number; onPage: (p: number) => void; total?: number }) {
  if (pages <= 1) return total !== undefined ? <p className="micro" style={{ paddingTop: 8 }}>{total} total · end of list</p> : null;
  return (
    <div className="pager">
      <button type="button" className="btn sm" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="micro">
        Page {page + 1} / {pages}
        {total !== undefined ? ` · ${total}` : ""}
      </span>
      <button type="button" className="btn sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}

export function paginate<T>(items: T[], page: number, size = 20): { slice: T[]; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages - 1);
  return { slice: items.slice(p * size, p * size + size), pages };
}

export function Toaster() {
  return <SonnerToaster position="bottom-right" offset={20} gap={8} visibleToasts={3} theme="system" />;
}

/** Toast wrapper. Short, dry confirmations ("Logged."). */
export const toast = {
  ok: (msg: string, desc?: string) => sonnerToast(msg, { description: desc, duration: 2600 }),
  err: (msg: string, desc?: string) => sonnerToast.error(msg, { description: desc, duration: 4000 }),
  info: (msg: string, desc?: string) => sonnerToast(msg, { description: desc, duration: 3000 }),
};
