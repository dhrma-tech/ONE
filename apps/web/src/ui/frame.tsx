import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import { useSeen } from "./hooks";

/** Dashed blueprint frame with "+" corner marks (heyalok signature). */
export function SectionFrame({
  children,
  className = "",
  style,
  id,
  as: Tag = "section",
  label,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  as?: "section" | "div" | "article";
  label?: string;
}) {
  return (
    <Tag className={`frame ${className}`} style={style} id={id} aria-label={label}>
      <span className="corner c-tl" aria-hidden />
      <span className="corner c-tr" aria-hidden />
      <span className="corner c-bl" aria-hidden />
      <span className="corner c-br" aria-hidden />
      {children}
    </Tag>
  );
}

/** Section title row: optional uppercase eyebrow, title, right-side actions. */
export function SectionHeader({
  eyebrow,
  title,
  right,
  level = 2,
}: {
  eyebrow?: string;
  title: ReactNode;
  right?: ReactNode;
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="section-head">
      <div>
        {eyebrow ? <span className="micro eyebrow">{eyebrow}</span> : null}
        <H>{title}</H>
      </div>
      {right ? <div className="row wrap">{right}</div> : null}
    </div>
  );
}

/** Surface card. `rise` animates in once when scrolled into view. */
export function Card({
  children,
  title,
  eyebrow,
  right,
  className = "",
  flat,
  edge,
  rise = true,
  style,
  id,
}: {
  children: ReactNode;
  title?: ReactNode;
  eyebrow?: string;
  right?: ReactNode;
  className?: string;
  flat?: boolean;
  edge?: boolean;
  rise?: boolean;
  style?: CSSProperties;
  id?: string;
}) {
  const [ref, seen] = useSeen<HTMLElement>();
  return (
    <section
      ref={ref}
      id={id}
      style={style}
      data-seen={seen ? 1 : 0}
      className={["card", flat && "flat", edge && "accent-edge", rise && "in-view-rise", className].filter(Boolean).join(" ")}
    >
      {title || right || eyebrow ? (
        <div className="card-title">
          <div className="stack tight">
            {eyebrow ? <span className="micro">{eyebrow}</span> : null}
            {title ? <h3>{title}</h3> : null}
          </div>
          {right ? <div className="row">{right}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export interface IndexRowProps {
  n: number;
  category: string;
  title: ReactNode;
  meta?: ReactNode;
  to?: string;
  onClick?: () => void;
  active?: boolean;
  section?: string;
}

/** Numbered index row: "01  CAREER  title  meta  →". */
export function IndexRow({ n, category, title, meta, to, onClick, active, section }: IndexRowProps) {
  const style = section ? ({ "--row-accent": `var(--accent-${section})` } as CSSProperties) : undefined;
  const inner = (
    <>
      <span className="idx">{String(n).padStart(2, "0")}</span>
      <span className="micro cat cat-col">{category}</span>
      <span className="ttl row">
        {active ? <span className="pulse-dot" aria-hidden /> : null}
        <span className="truncate">{title}</span>
      </span>
      <span className="muted small">{meta}</span>
      <span className="go" aria-hidden>
        <Icon name="arrow" size={14} />
      </span>
    </>
  );
  const cls = `index-row${active ? " active" : ""}`;
  if (to)
    return (
      <Link to={to} className={cls} style={style}>
        {inner}
      </Link>
    );
  return (
    <button type="button" className={cls} style={{ ...style, width: "100%", textAlign: "left" }} onClick={onClick}>
      {inner}
    </button>
  );
}

export function IndexTable({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="index-table">
      <div className="index-head">
        <span className="micro">✦ {label}</span>
        <span className="micro">{right}</span>
      </div>
      {children}
    </div>
  );
}

const DRY_EMPTY = [
  "Nothing here. Suspiciously quiet.",
  "Empty. Like a gym at 6:29 AM.",
  "Zero entries. Plenty of potential.",
  "Nothing yet. Houston, we have no problem.",
];

/** Empty state with dry humour. */
export function Empty({ children, glyph = "∅", action }: { children?: ReactNode; glyph?: string; action?: ReactNode }) {
  const [line] = useState(() => DRY_EMPTY[Math.floor(Math.random() * DRY_EMPTY.length)]);
  return (
    <div className="empty">
      <span className="glyph" aria-hidden>
        {glyph}
      </span>
      <p className="small">{children ?? line}</p>
      {action}
    </div>
  );
}

/** Big centred quote with per-word fade-in and attribution between hairlines. */
export function QuoteBlock({ text, by, source }: { text: string; by: string; source?: string }) {
  const [ref, seen] = useSeen<HTMLElement>();
  return (
    <SectionFrame as="div">
      <figure ref={ref} data-seen={seen ? 1 : 0} className="quote" style={{ margin: 0, padding: 0 }}>
        <blockquote>
          {text.split(/\s+/).map((w, i) => (
            <span key={i} className="word" style={{ "--w": i } as CSSProperties}>
              {w}
            </span>
          ))}
        </blockquote>
        <figcaption className="micro">
          {by}
          {source ? ` · ${source}` : ""}
        </figcaption>
      </figure>
    </SectionFrame>
  );
}

/** Small hand-drawn arrow annotation for first-run hints. */
export function HandArrow({ children, flip }: { children: ReactNode; flip?: boolean }) {
  return (
    <span className="hand-note" style={flip ? { flexDirection: "row-reverse" } : undefined}>
      <svg width="54" height="26" viewBox="0 0 54 26" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
        <path d="M2 20 C 12 4, 22 26, 30 12 S 44 6, 50 8" />
        <path d="M44 3 L 51 8 L 44 13" />
      </svg>
      {children}
    </span>
  );
}

/** Live countdown "12d 4h" to a target date. */
export function Countdown({ to, label }: { to: Date; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const ms = to.getTime() - now;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return (
    <span className="num" aria-label={label}>
      {ms <= 0 ? "now" : d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`}
    </span>
  );
}
