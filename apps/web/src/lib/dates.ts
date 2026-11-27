// Date helpers. ONE stores daily data as "YYYY-MM-DD" in Asia/Kolkata (Dharma's timezone).
export const TZ = "Asia/Kolkata";
export type ISODate = string;

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Local (IST) calendar date of an instant. */
export const isoDate = (d: Date = new Date()): ISODate => fmt.format(d);

/** IST hour 0-23 of an instant. */
export const istHour = (d: Date = new Date()): number => Number(timeFmt.format(d).slice(0, 2));
export const istTime = (d: Date = new Date()): string => timeFmt.format(d);

export const today = (): ISODate => isoDate(new Date());

/** Treat an ISO date as UTC midnight for pure date arithmetic. */
const toUTC = (iso: ISODate): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: ISODate, n: number): ISODate => fromUTC(toUTC(iso) + n * 86_400_000);
export const daysBetween = (a: ISODate, b: ISODate): number => Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
/** 0 = Sunday ... 6 = Saturday */
export const dow = (iso: ISODate): number => new Date(toUTC(iso)).getUTCDay();
/** Monday of the ISO week containing the date. */
export const weekStart = (iso: ISODate): ISODate => addDays(iso, -((dow(iso) + 6) % 7));
export const monthStart = (iso: ISODate): ISODate => `${iso.slice(0, 8)}01`;
export const range = (from: ISODate, to: ISODate): ISODate[] => {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
export const lastNDays = (n: number, end: ISODate = today()): ISODate[] => range(addDays(end, -(n - 1)), end);

/** ISO week label like "2026-W48". */
export function isoWeek(iso: ISODate): string {
  const t = new Date(toUTC(iso));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const monthName = (iso: ISODate): string => MONTHS[Number(iso.slice(5, 7)) - 1];
export const dayName = (iso: ISODate): string => DAYS[dow(iso)];
export const pretty = (iso: ISODate): string => `${dayName(iso)} ${Number(iso.slice(8, 10))} ${monthName(iso)}`;
export const shortDate = (iso: ISODate): string => `${Number(iso.slice(8, 10))} ${monthName(iso)}`;

/**
 * The date a nightly review belongs to. Between 00:00 and 03:59 IST it is still "last night".
 */
export const reviewDate = (d: Date = new Date()): ISODate => (istHour(d) < 4 ? addDays(isoDate(d), -1) : isoDate(d));

export const fmtMin = (min: number): string => {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`;
};
export const fmtClock = (sec: number): string => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
export const relTime = (iso: string, now = Date.now()): string => {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/** "HH:MM" → minutes since midnight. */
export const timeToMin = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
