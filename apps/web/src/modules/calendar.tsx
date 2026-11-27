// Today's Google Calendar events (read-only) for Home. Data comes from /api/google/events (Phase 10).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "@/lib/api";
import { today } from "@/lib/dates";
import { Card, Empty, Icon } from "@/ui";

export interface CalEvent {
  id: string;
  title: string;
  start: string; // ISO or date
  end?: string;
  allDay?: boolean;
  calendar?: string;
}

const CACHE = "one.cal.today";

export function useTodayEvents(): { events: CalEvent[]; state: "loading" | "ok" | "off" | "error" } {
  const d = today();
  const [s, setS] = useState<{ events: CalEvent[]; state: "loading" | "ok" | "off" | "error" }>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE) || "null");
      if (c?.date === d) return { events: c.events, state: "ok" };
    } catch {
      /* ignore */
    }
    return { events: [], state: "loading" };
  });
  useEffect(() => {
    let alive = true;
    api
      .get<{ events: CalEvent[] }>(`/api/google/events?date=${d}`)
      .then((r) => {
        if (!alive) return;
        setS({ events: r.events, state: "ok" });
        try {
          localStorage.setItem(CACHE, JSON.stringify({ date: d, events: r.events }));
        } catch {
          /* ignore */
        }
      })
      .catch((e) => alive && setS((x) => ({ events: x.events, state: e instanceof ApiError && (e.status === 401 || e.status === 409 || e.status === 404) ? "off" : x.events.length ? "ok" : "error" })));
    return () => {
      alive = false;
    };
  }, [d]);
  return s;
}

const hm = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function CalendarToday({ className = "" }: { className?: string }) {
  const { events, state } = useTodayEvents();
  return (
    <Card className={className} eyebrow="Google Calendar" title="Schedule" right={<Icon name="calendar" />}>
      {state === "off" ? (
        <Empty glyph="◷">
          Calendar not connected. <Link to="/settings/integrations" className="accent">Connect it</Link> to see today here.
        </Empty>
      ) : events.length ? (
        <ul className="list">
          {events.map((e) => (
            <li key={e.id}>
              <span className="mono xs muted" style={{ width: 86, flex: "none" }}>
                {e.allDay ? "all day" : `${hm(e.start)}${e.end ? `–${hm(e.end)}` : ""}`}
              </span>
              <span className="small grow truncate">{e.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty glyph="◷">{state === "loading" ? "Checking the calendar…" : state === "error" ? "Calendar unreachable. Plans still count." : "Nothing scheduled. Make your own luck."}</Empty>
      )}
    </Card>
  );
}
