import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./icons";

type BtnVariant = "default" | "primary" | "accent" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  block?: boolean;
}

/** Standard button. Variants: default, primary, accent (section colour), ghost, danger. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", icon, block, className = "", children, type = "button", ...rest },
  ref,
) {
  const cls = ["btn", variant !== "default" && variant, size !== "md" && size, block && "block", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type} className={cls} {...rest}>
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: "sm" | "md";
  round?: boolean;
}

/** Icon-only button. `label` is required and becomes the aria-label and tooltip. */
export function IconButton({ icon, label, size = "md", round, className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={["icon-btn", size === "sm" && "sm", round && "round", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 14 : 18} />
    </button>
  );
}

/** Uppercase pill with a nudging arrow, e.g. "SHOW ALL →". Renders a Link when `to` is set. */
export function PillButton({
  children,
  to,
  onClick,
  arrow = true,
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  arrow?: boolean;
}) {
  const inner = (
    <>
      {children}
      {arrow ? <Icon name="arrow" size={14} className="arrow" /> : null}
    </>
  );
  return to ? (
    <Link to={to} className="pill">
      {inner}
    </Link>
  ) : (
    <button type="button" className="pill" onClick={onClick}>
      {inner}
    </button>
  );
}

/** Pill centred between two hairlines. */
export function PillDivider(props: Parameters<typeof PillButton>[0]) {
  return (
    <div className="pill-divider">
      <PillButton {...props} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}

export function Chip({
  children,
  tone,
  on,
  onClick,
  dot,
  section,
  title,
}: {
  children: ReactNode;
  tone?: "ok" | "warn" | "bad";
  on?: boolean;
  onClick?: () => void;
  dot?: boolean;
  section?: string;
  title?: string;
}) {
  const cls = ["chip", tone, section && "sec"].filter(Boolean).join(" ");
  const style = section ? ({ "--chip-accent": `var(--accent-${section})` } as React.CSSProperties) : undefined;
  const body = (
    <>
      {dot ? <span className="dot" /> : null}
      {children}
    </>
  );
  return onClick ? (
    <button type="button" className={cls} aria-pressed={!!on} onClick={onClick} style={style} title={title}>
      {body}
    </button>
  ) : (
    <span className={cls} style={style} title={title}>
      {body}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }>(
  function Input({ label, hint, className = "", id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    const el = <input ref={ref} id={fid} className={["input", className].join(" ")} {...rest} />;
    return label ? (
      <Field label={label} hint={hint} htmlFor={fid}>
        {el}
      </Field>
    ) : (
      el
    );
  },
);

export function Textarea({
  label,
  hint,
  id,
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode }) {
  const auto = useId();
  const fid = id ?? auto;
  const el = <textarea id={fid} className={["textarea", className].join(" ")} {...rest} />;
  return label ? (
    <Field label={label} hint={hint} htmlFor={fid}>
      {el}
    </Field>
  ) : (
    el
  );
}

export function Select({
  label,
  hint,
  id,
  options,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}) {
  const auto = useId();
  const fid = id ?? auto;
  const el = (
    <select id={fid} className={["select", className].join(" ")} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
  return label ? (
    <Field label={label} hint={hint} htmlFor={fid}>
      {el}
    </Field>
  ) : (
    el
  );
}

/** Neumorphic switch (inset track, raised knob). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="track" aria-hidden>
        <span className="knob" />
      </span>
      <span className="small">{label}</span>
    </label>
  );
}

/** − value + stepper for quick numeric entry. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - step))}>
        −
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(clamp(n));
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + step))}>
        +
      </button>
    </div>
  );
}

/** 1-5 rating. Read-only when no onChange. */
export function Stars({ value, onChange, label = "Rating" }: { value: number; onChange?: (v: number) => void; label?: string }) {
  return (
    <span className="stars" role={onChange ? "radiogroup" : "img"} aria-label={`${label}: ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={n <= value ? "on" : ""}
            onClick={() => onChange(n === value ? 0 : n)}
          >
            <Icon name="star" size={14} />
          </button>
        ) : (
          <span key={n} className={n <= value ? "on" : ""}>
            <Icon name="star" size={12} />
          </span>
        ),
      )}
    </span>
  );
}

export function Skeleton({ h = 14, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden />;
}
