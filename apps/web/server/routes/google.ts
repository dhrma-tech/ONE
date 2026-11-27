// Google Calendar: OAuth code flow (offline access, refresh token encrypted server-side), today's events
// from all calendars (read-only), and pushing planned blocks into a dedicated "ONE" calendar.
// Only the nightly review event carries a reminder (popup). Everything else has reminders disabled.
import { createHash } from "node:crypto";
import { env, HttpError, json, type ApiRequest, type Handler } from "../http.js";
import { requireUser } from "../auth.js";
import { signState, verifyState } from "../crypto.js";
import { deleteSecret, getSecret, needSupabase, putSecret, setIntegrationStatus } from "../supabaseAdmin.js";

export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];
const TZ = "Asia/Kolkata";
const API = "https://www.googleapis.com/calendar/v3";

interface Stored {
  refresh_token: string;
  calendar_id?: string;
  pushed?: string[];
}

function cfg() {
  const id = env("GOOGLE_CLIENT_ID");
  const secret = env("GOOGLE_CLIENT_SECRET");
  const redirect = env("GOOGLE_REDIRECT_URI");
  if (!id || !secret || !redirect) throw new HttpError(409, "google_not_configured");
  return { id, secret, redirect };
}

async function load(userId: string): Promise<Stored> {
  const raw = await getSecret(userId, "google");
  if (!raw) throw new HttpError(409, "google_not_connected");
  return JSON.parse(raw) as Stored;
}
const save = (userId: string, s: Stored) => putSecret(userId, "google", JSON.stringify(s));

const tokenCache = new Map<string, { token: string; until: number }>();
async function accessToken(userId: string, s: Stored): Promise<string> {
  const hit = tokenCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.token;
  const c = cfg();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: s.refresh_token, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!r.ok || !j.access_token) {
    if (j.error === "invalid_grant") {
      await setIntegrationStatus(userId, "google", "error", "reconnect_needed");
      throw new HttpError(401, "google_reconnect_needed");
    }
    throw new Error(`google_token_${r.status}`);
  }
  tokenCache.set(userId, { token: j.access_token, until: Date.now() + ((j.expires_in ?? 3600) - 120) * 1000 });
  return j.access_token;
}

async function g<T>(token: string, path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }, signal: AbortSignal.timeout(10_000) });
  const txt = await r.text();
  return { status: r.status, body: (txt ? JSON.parse(txt) : null) as T };
}

/** POST /api/google/auth-url → URL to send the browser to (state signed with the user id). */
export const authUrl: Handler = async (req) => {
  needSupabase();
  const user = await requireUser(req);
  const c = cfg();
  const p = new URLSearchParams({
    client_id: c.id,
    redirect_uri: c.redirect,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: signState({ uid: user.id }),
  });
  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
};

/** GET /api/google/callback?code&state → store refresh token, ensure the ONE calendar, redirect to Settings. */
export const callback: Handler = async (req) => {
  const back = (q: string) => ({ status: 302, redirect: `${env("APP_ORIGIN") || ""}/settings/integrations?google=${q}` });
  const st = verifyState<{ uid: string }>(req.query.get("state") ?? "");
  if (!st) return back("bad_state");
  if (req.query.get("error")) return back("denied");
  const c = cfg();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: req.query.get("code") ?? "", client_id: c.id, client_secret: c.secret, redirect_uri: c.redirect, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json()) as { refresh_token?: string; access_token?: string };
  if (!r.ok || !j.refresh_token || !j.access_token) return back("no_refresh_token");
  const stored: Stored = { refresh_token: j.refresh_token };
  stored.calendar_id = await ensureCalendar(j.access_token);
  await save(st.uid, stored);
  await setIntegrationStatus(st.uid, "google", "connected");
  return back("connected");
};

async function ensureCalendar(token: string, existing?: string): Promise<string> {
  if (existing) {
    const r = await g<{ id: string }>(token, `/calendars/${encodeURIComponent(existing)}`);
    if (r.status === 200) return existing;
  }
  const c = await g<{ id: string }>(token, "/calendars", { method: "POST", body: JSON.stringify({ summary: "ONE", description: "Planned blocks from ONE. Managed by the app.", timeZone: TZ }) });
  if (c.status >= 300) throw new Error(`google_create_calendar_${c.status}`);
  return c.body.id;
}

/** GET /api/google/events?date=YYYY-MM-DD → today's events across the user's calendars (read-only). */
export const events: Handler = async (req) => {
  needSupabase();
  const user = await requireUser(req);
  const s = await load(user.id);
  const token = await accessToken(user.id, s);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.get("date") ?? "") ? req.query.get("date")! : new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const timeMin = new Date(`${date}T00:00:00+05:30`).toISOString();
  const timeMax = new Date(`${date}T23:59:59+05:30`).toISOString();
  const list = await g<{ items: { id: string; summary?: string; selected?: boolean; hidden?: boolean }[] }>(token, "/users/me/calendarList?maxResults=50");
  const cals = (list.body?.items ?? []).filter((c) => c.selected !== false && !c.hidden).slice(0, 12);
  const out: { id: string; title: string; start: string; end?: string; allDay: boolean; calendar: string }[] = [];
  await Promise.all(
    cals.map(async (c) => {
      const r = await g<{ items?: { id: string; summary?: string; status?: string; start: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }[] }>(
        token,
        `/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`,
      );
      for (const e of r.body?.items ?? []) {
        if (e.status === "cancelled") continue;
        out.push({ id: `${c.id}:${e.id}`, title: e.summary ?? "(busy)", start: e.start.dateTime ?? e.start.date ?? date, end: e.end?.dateTime ?? e.end?.date, allDay: !e.start.dateTime, calendar: c.summary ?? "" });
      }
    }),
  );
  out.sort((a, b) => (a.allDay === b.allDay ? (a.start < b.start ? -1 : 1) : a.allDay ? -1 : 1));
  return json({ events: out.slice(0, 40) }, 200, { "cache-control": "private, max-age=300" });
};

export interface PushEvent {
  key: string; // stable local key, e.g. "habit:<id>", "exam:<id>", "review"
  summary: string;
  description?: string;
  start: string; // "YYYY-MM-DD" (all-day) or "YYYY-MM-DDTHH:MM" (IST local)
  end?: string;
  rrule?: string; // e.g. "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
  reminder?: boolean; // only the nightly review should set this
}

/** Deterministic Google event id (base32hex alphabet a-v0-9 → hex is a subset). */
export const eventId = (key: string) => `one${createHash("sha256").update(key).digest("hex").slice(0, 40)}`;

export function toGoogle(e: PushEvent) {
  const allDay = e.start.length === 10;
  const end = e.end ?? e.start;
  return {
    id: eventId(e.key),
    summary: e.summary,
    description: `${e.description ? `${e.description}\n\n` : ""}Managed by ONE. Edits here are overwritten.`,
    start: allDay ? { date: e.start } : { dateTime: `${e.start}:00`, timeZone: TZ },
    end: allDay ? { date: end === e.start ? nextDay(e.start) : end } : { dateTime: `${end}:00`, timeZone: TZ },
    ...(e.rrule ? { recurrence: [e.rrule] } : {}),
    reminders: e.reminder ? { useDefault: false, overrides: [{ method: "popup", minutes: 0 }] } : { useDefault: false, overrides: [] },
    status: "confirmed",
    transparency: "transparent",
  };
}
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** POST /api/google/push { events: PushEvent[] } → upsert into the ONE calendar, delete ones no longer planned. */
export const push: Handler = async (req: ApiRequest) => {
  needSupabase();
  const user = await requireUser(req);
  const body = req.body as { events?: PushEvent[] };
  const list = (body?.events ?? []).filter((e) => e && typeof e.key === "string" && typeof e.summary === "string" && typeof e.start === "string").slice(0, 200);
  const s = await load(user.id);
  const token = await accessToken(user.id, s);
  const cal = await ensureCalendar(token, s.calendar_id);
  const base = `/calendars/${encodeURIComponent(cal)}/events`;
  let upserted = 0;
  for (const e of list) {
    const ev = toGoogle(e);
    const p = await g(token, `${base}/${ev.id}`, { method: "PUT", body: JSON.stringify(ev) });
    if (p.status === 404) {
      const ins = await g(token, base, { method: "POST", body: JSON.stringify(ev) });
      if (ins.status < 300) upserted++;
    } else if (p.status < 300) upserted++;
  }
  const keep = new Set(list.map((e) => eventId(e.key)));
  let removed = 0;
  for (const id of s.pushed ?? []) {
    if (keep.has(id)) continue;
    const d = await g(token, `${base}/${id}`, { method: "DELETE" });
    if (d.status < 300 || d.status === 410 || d.status === 404) removed++;
  }
  await save(user.id, { ...s, calendar_id: cal, pushed: [...keep] });
  await setIntegrationStatus(user.id, "google", "connected");
  return json({ ok: true, upserted, removed, calendar: "ONE" });
};

/** POST /api/google/disconnect → revoke and forget the token. */
export const disconnect: Handler = async (req) => {
  needSupabase();
  const user = await requireUser(req);
  const raw = await getSecret(user.id, "google");
  if (raw) {
    const s = JSON.parse(raw) as Stored;
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refresh_token)}`, { method: "POST" }).catch(() => undefined);
  }
  await deleteSecret(user.id, "google");
  await setIntegrationStatus(user.id, "google", "off");
  return json({ ok: true });
};
