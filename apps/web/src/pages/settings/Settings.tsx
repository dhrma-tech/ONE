import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { Banner, Button, Card, Chip, Empty, Input, RouteTabs, Select, Switch, toast } from "@/ui";
import { ui, useUI } from "@/data/ui";
import { auth, useAuth } from "@/data/supabase";
import { syncNow, useSyncState } from "@/data/syncRunner";
import { LOCAL_MODE, env } from "@/env";
import { api } from "@/lib/api";
import { relTime } from "@/lib/dates";
import { patchProfile, patchSettings, patchTargets, useProfile, useSettings, useTargets } from "@/services/settings";
import { refreshChess, refreshGithub, refreshLeetcode, setStatus, useStatus, type Provider } from "@/services/integrations";
import { pushCalendar } from "@/services/calendarPush";
import { PUBLIC_STATS, refreshDerivedStats } from "@/services/derived";
import { downloadJson, exportAll, importAll } from "@/services/dataio";
import { TARGET_LABELS, type Targets } from "@/domain/targets";
import { appleMusicEmbed } from "@/modules/music";
import { obsidian, useObsidian } from "@/modules/obsidian";
import { compressImage } from "@/services/blobs";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "integrations", label: "Integrations" },
  { id: "public", label: "Public stats" },
  { id: "modules", label: "Modules" },
  { id: "targets", label: "Targets" },
  { id: "data", label: "Data" },
  { id: "account", label: "Account" },
];

function Profile() {
  const p = useProfile();
  const s = useSettings();
  if (!p || !s) return <p className="micro">Loading…</p>;
  const u = (s.usernames ?? {}) as Record<string, string>;
  return (
    <div className="bento">
      <Card className="span-6" title="Profile">
        <div className="stack" key={p.id}>
          <Input label="Name" defaultValue={p.name} onBlur={(e) => void patchProfile({ name: e.target.value || p.name })} />
          <Input label="Tagline" defaultValue={p.tagline ?? ""} onBlur={(e) => void patchProfile({ tagline: e.target.value })} />
          <Select label="Target title" value={p.target_title ?? "AI Engineer"} onChange={(e) => void patchProfile({ target_title: e.target.value })} options={[{ value: "AI Engineer", label: "AI Engineer" }, { value: "AI/ML Engineer", label: "AI/ML Engineer" }]} />
          <Input label="Lock-in start date (Day 1)" type="date" defaultValue={p.lock_in_start_date ?? ""} onBlur={(e) => void patchProfile({ lock_in_start_date: e.target.value || null })} />
          <Input label="Timezone" defaultValue={p.timezone} disabled hint="Asia/Kolkata. All daily data uses this." />
          <label className="btn" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
            Upload photo
            <input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const b = await compressImage(f, 320, 0.85);
              const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
              await patchProfile({ photo_url: url });
              toast.ok("Photo updated.");
            }} />
          </label>
        </div>
      </Card>
      <Card className="span-6" title="Usernames" eyebrow="Public handles only. No passwords here.">
        <div className="stack" key={s.id}>
          <Input label="Chess.com username" defaultValue={u.chesscom ?? ""} onBlur={(e) => void patchSettings({ usernames: { ...u, chesscom: e.target.value.trim() } })} />
          <Input label="LeetCode username" defaultValue={u.leetcode ?? ""} onBlur={(e) => void patchSettings({ usernames: { ...u, leetcode: e.target.value.trim() } })} />
          <Input label="GitHub username" defaultValue={u.github ?? "dhrma-tech"} disabled hint="Set server-side via GITHUB_USERNAME." />
        </div>
      </Card>
    </div>
  );
}

function Appearance() {
  const { theme, motion } = useUI();
  const s = useSettings();
  const accents = useMemo(() => (s?.accents ?? {}) as Record<string, string>, [s?.accents]);
  useEffect(() => {
    for (const k of ["career", "mind", "body", "persona"]) {
      if (accents[k]) document.documentElement.style.setProperty(`--accent-${k}`, accents[k]);
      else document.documentElement.style.removeProperty(`--accent-${k}`);
    }
  }, [accents]);
  return (
    <div className="bento">
      <Card className="span-6" title="Theme and motion">
        <div className="stack">
          <Switch checked={theme === "light"} onChange={(v) => ui.setTheme(v ? "light" : "dark")} label="Light lavender theme (press d anywhere)" />
          <Select label="Motion" value={motion} onChange={(e) => ui.setMotion(e.target.value as "full" | "reduced" | "system")} options={[{ value: "system", label: "Follow system" }, { value: "full", label: "Full" }, { value: "reduced", label: "Reduced (no loops)" }]} />
          <Select
            label="Font size"
            value={String(s?.font_scale ?? 1)}
            onChange={(e) => { const v = Number(e.target.value); void patchSettings({ font_scale: v }); document.documentElement.style.setProperty("--font-scale", String(v)); }}
            options={[{ value: "0.9", label: "Small" }, { value: "1", label: "Default" }, { value: "1.1", label: "Large" }, { value: "1.2", label: "Larger" }]}
          />
        </div>
      </Card>
      <Card className="span-6" title="Section accents" eyebrow="Defaults pass AA contrast in both themes">
        <div className="stack">
          {(["career", "mind", "body", "persona"] as const).map((k) => (
            <div key={k} className="row">
              <input type="color" aria-label={`${k} accent`} value={accents[k] ?? (getComputedStyle(document.documentElement).getPropertyValue(`--accent-${k}`).trim() || "#ffffff")} onChange={(e) => void patchSettings({ accents: { ...accents, [k]: e.target.value } })} style={{ width: 40, height: 32, border: 0, background: "none" }} />
              <span className="small grow" style={{ color: `var(--accent-${k})` }}>{k.toUpperCase()}</span>
              {accents[k] ? <Button size="sm" variant="ghost" onClick={() => { const n = { ...accents }; delete n[k]; void patchSettings({ accents: n }); }}>Reset</Button> : null}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusChip({ provider }: { provider: Provider }) {
  const s = useStatus(provider);
  const st = s?.status ?? "off";
  return (
    <Chip tone={st === "connected" ? "ok" : st === "error" ? "bad" : st === "stale" ? "warn" : undefined} dot title={s?.last_error ?? undefined}>
      {st}{s?.last_ok_at ? ` · ${relTime(s.last_ok_at)}` : ""}
    </Chip>
  );
}

function Integrations() {
  const [cfg, setCfg] = useState<Record<string, boolean> | null>(null);
  const [params] = useSearchParams();
  const s = useSettings();
  const o = useObsidian();
  const [music, setMusic] = useState("");
  useEffect(() => {
    void api.get<Record<string, boolean>>("/api/config").then(setCfg).catch(() => setCfg({}));
  }, []);
  useEffect(() => {
    const g = params.get("google");
    if (g === "connected") { toast.ok("Google Calendar connected."); void setStatus("google", "connected"); }
    else if (g) toast.err(`Google: ${g.replace(/_/g, " ")}`);
  }, [params]);
  const test = async (label: string, fn: () => Promise<boolean>) => {
    const ok = await fn();
    toast[ok ? "ok" : "err"](`${label}: ${ok ? "working" : "not working (see status)"}`);
  };
  const row = (provider: Provider, name: string, desc: string, actions: React.ReactNode, configured?: boolean) => (
    <li key={provider} style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
      <span className="stack tight grow" style={{ minWidth: 220 }}>
        <span className="small">{name} {configured === false ? <Chip>server key missing</Chip> : null}</span>
        <span className="xs muted text">{desc}</span>
      </span>
      <StatusChip provider={provider} />
      <span className="row wrap">{actions}</span>
    </li>
  );
  return (
    <Card title="Integrations" eyebrow="Each one fails gracefully. Secrets live only on the server.">
      <ul className="list">
        {row("google", "Google Calendar", "Pushes planned blocks to a dedicated ONE calendar (only the 11:30 PM review has a reminder) and shows today's events on Home.", <>
          <Button size="sm" disabled={!cfg?.google || !cfg?.supabase} onClick={async () => { try { const r = await api.post<{ url: string }>("/api/google/auth-url"); location.href = r.url; } catch (e) { toast.err(String((e as Error).message)); } }}>Connect</Button>
          <Button size="sm" onClick={async () => { try { const r = await pushCalendar(); toast.ok(`Calendar synced: ${r.upserted} events.`); } catch (e) { toast.err(String((e as Error).message)); } }}>Push now</Button>
          <Button size="sm" variant="ghost" onClick={async () => { await api.post("/api/google/disconnect").catch(() => undefined); await setStatus("google", "off"); }}>Disconnect</Button>
        </>, cfg ? !!cfg.google : undefined)}
        {row("github", "GitHub", "Contribution grid and pushes for dhrma-tech (read-only token).", <Button size="sm" onClick={() => void test("GitHub", refreshGithub)}>Test</Button>, cfg ? !!cfg.github : undefined)}
        {row("leetcode", "LeetCode", "Unofficial API. Shows the last snapshot with a stale tag if it breaks.", <Button size="sm" disabled={!s?.usernames?.leetcode} onClick={() => void test("LeetCode", refreshLeetcode)}>Test</Button>)}
        {row("chesscom", "Chess.com", "Public Published-Data API, no key. Polite User-Agent + caching.", <Button size="sm" disabled={!s?.usernames?.chesscom} onClick={() => void test("Chess.com", refreshChess)}>Test</Button>)}
        {row("buffer", "Buffer", "Queues LinkedIn and X posts. Fallbacks always work without it.", <Button size="sm" onClick={async () => { try { const r = await api.get<{ channels: { service: string }[] }>("/api/buffer/channels"); await setStatus("buffer", "connected", undefined, { channels: r.channels.map((c) => c.service) }); toast.ok(`Buffer: ${r.channels.map((c) => c.service).join(", ") || "no channels"}`); } catch (e) { await setStatus("buffer", "error", String((e as Error).message)); toast.err("Buffer not reachable."); } }}>Test</Button>, cfg ? !!cfg.buffer : undefined)}
        {row("youtube", "YouTube", "Data API key is optional: oEmbed works without it (no duration).", <Chip tone={cfg?.youtube ? "ok" : undefined}>{cfg?.youtube ? "API key set" : "oEmbed only"}</Chip>)}
        {row("apple_music", "Apple Music", "Embed player in the music corner. Previews without sign-in; full tracks when signed in inside the player.", <form className="row" onSubmit={(e) => { e.preventDefault(); if (appleMusicEmbed(music)) { void patchSettings({ music_url: music }); void setStatus("apple_music", "connected"); setMusic(""); toast.ok("Saved. Open the music corner."); } else toast.err("Not an Apple Music link."); }}><Input aria-label="Apple Music link" placeholder={s?.music_url ?? "music.apple.com/…"} value={music} onChange={(e) => setMusic(e.target.value)} style={{ width: 240 }} /><Button type="submit" size="sm">Save</Button></form>)}
        {row("obsidian", "Obsidian mirror", o.supported ? `Markdown backup into your vault folder${o.folder ? ` (${o.folder})` : ""}. ONE owns these files.` : "Not supported in this browser (needs Chrome/Edge or the desktop app). Skipped silently.", <>
          <Button size="sm" disabled={!o.supported} onClick={() => void obsidian.pick().then((n) => n && toast.ok(`Folder: ${n}`))}>Choose folder</Button>
          <Button size="sm" disabled={!o.folder} onClick={() => void obsidian.mirrorAll().then((n) => toast.ok(`Mirrored ${n} files.`)).catch((e) => toast.err(String(e.message ?? e)))}>Mirror now</Button>
        </>)}
      </ul>
      {cfg && !cfg.supabase ? <p className="notice" style={{ marginTop: 12 }}>Local mode: Google Calendar needs the Supabase project (it stores the refresh token encrypted). See NEEDS-FROM-DHARMA.md.</p> : null}
    </Card>
  );
}

function PublicStats() {
  const s = useSettings();
  const flags = (s?.public_stat_flags ?? {}) as Record<string, boolean>;
  const [preview, setPreview] = useState<unknown>(null);
  return (
    <div className="bento">
      <Card className="span-7" title="Public stats" eyebrow="For the portfolio widget. All off by default.">
        <ul className="list">
          {PUBLIC_STATS.map((p) => (
            <li key={p.key}>
              <span className="small grow">{p.label}</span>
              <Switch checked={!!flags[p.key]} onChange={(v) => void patchSettings({ public_stat_flags: { ...flags, [p.key]: v } }).then(() => refreshDerivedStats(true))} label={flags[p.key] ? "public" : "private"} />
            </li>
          ))}
        </ul>
        <p className="xs muted" style={{ marginTop: 8 }}>Weight, photos, diet, journal, contacts and recordings can never be public.</p>
      </Card>
      <Card className="span-5" title="Preview" eyebrow="GET /api/public-stats">
        <Button size="sm" onClick={async () => setPreview(await api.get("/api/public-stats").catch((e) => ({ error: String(e) })))}>Fetch</Button>
        {preview ? <pre className="mono xs" style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{JSON.stringify(preview, null, 2)}</pre> : null}
      </Card>
    </div>
  );
}

function Modules() {
  const s = useSettings();
  const m = (s?.modules ?? {}) as Record<string, boolean>;
  const set = (k: string, v: boolean) => void patchSettings({ modules: { ...m, [k]: v } });
  return (
    <Card title="MIND modules" eyebrow="Locked until you switch them on">
      <div className="stack">
        <Switch checked={!!m.cube} onChange={(v) => set("cube", v)} label="Cube timer (first target: under 2 minutes)" />
        <Switch checked={!!m.math} onChange={(v) => set("math", v)} label="Mental math (5 minutes a day)" />
        <Switch checked={!!m.palace} onChange={(v) => set("palace", v)} label="Memory palace (2 × 15 min a week)" />
      </div>
    </Card>
  );
}

function TargetsTab() {
  const t = useTargets();
  const keys = Object.keys(TARGET_LABELS) as (keyof Targets)[];
  return (
    <Card title="Targets" eyebrow="Every number in one place">
      <div className="form-grid" key={JSON.stringify(t)}>
        {keys.map((k) => {
          const v = t[k];
          if (k === "gym_days") return <Input key={k} label={TARGET_LABELS[k]} defaultValue={(v as number[]).map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")} disabled hint="Edit in BODY › Schedule." />;
          const isTime = typeof v === "string";
          return (
            <Input
              key={k}
              label={TARGET_LABELS[k]}
              type={isTime ? "time" : "text"}
              inputMode={isTime ? undefined : "decimal"}
              defaultValue={v === null ? "" : String(v)}
              placeholder={k === "water_ml" ? "set your target" : undefined}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                void patchTargets({ [k]: isTime ? raw : raw === "" ? (k === "water_ml" ? null : v) : Number(raw) } as Partial<Targets>);
              }}
            />
          );
        })}
      </div>
    </Card>
  );
}

function Data() {
  const file = useRef<HTMLInputElement>(null);
  const sync = useSyncState();
  const log = useLiveQuery(async () => (await db.sync_log.orderBy("id").reverse().limit(20).toArray()), []);
  const counts = useLiveQuery(async () => ({ outbox: await db.outbox.count(), blobs: await db.blobs.where("uploaded").equals(0).count() }), []);
  return (
    <div className="bento">
      <Card className="span-6" title="Export / import" eyebrow="Your data, one JSON file">
        <div className="row wrap">
          <Button icon="download" onClick={async () => downloadJson(await exportAll(), `one-export-${new Date().toISOString().slice(0, 10)}.json`)}>Export everything</Button>
          <Button icon="upload" onClick={() => file.current?.click()}>Import JSON</Button>
          <input ref={file} type="file" accept="application/json" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const n = await importAll(JSON.parse(await f.text()));
              toast.ok(`Imported ${n} rows.`);
            } catch (err) {
              toast.err(String((err as Error).message));
            }
            e.target.value = "";
          }} />
        </div>
        <p className="xs muted" style={{ marginTop: 8 }}>Import merges: newer edits win per row. Photos and recordings stay in private storage and are not in the file.</p>
      </Card>
      <Card className="span-6" title="Sync" eyebrow={LOCAL_MODE ? "Local mode: this device only" : `Status: ${sync.status}`}>
        <div className="row wrap">
          <Chip>{counts?.outbox ?? 0} changes waiting</Chip>
          <Chip>{counts?.blobs ?? 0} files to upload</Chip>
          {sync.lastAt ? <Chip>last sync {relTime(sync.lastAt)}</Chip> : null}
          {!LOCAL_MODE ? <Button size="sm" icon="refresh" onClick={() => void syncNow()}>Sync now</Button> : null}
        </div>
        <ul className="list" style={{ marginTop: 8 }}>
          {(log ?? []).map((l) => <li key={l.id}><Chip tone={l.kind === "error" ? "bad" : l.kind === "conflict" ? "warn" : undefined}>{l.kind}</Chip><span className="xs grow">{l.message}</span><span className="xs muted">{relTime(l.at)}</span></li>)}
        </ul>
        {!log?.length ? <Empty glyph="✓">No sync conflicts or errors.</Empty> : null}
      </Card>
    </div>
  );
}

function Account() {
  const a = useAuth();
  return (
    <Card title="Account">
      {LOCAL_MODE ? (
        <p className="small">Local mode. No account; data stays in this browser until Supabase is configured (see README).</p>
      ) : (
        <div className="stack">
          <p className="small">Signed in as <span className="mono">{a.email}</span></p>
          <p className="xs muted">Sessions: this device. Sign out everywhere from the Supabase dashboard if a device is lost.</p>
          <Button variant="danger" onClick={() => void auth.signOut()}>Sign out</Button>
        </div>
      )}
      <p className="xs muted" style={{ marginTop: 12 }}>ONE v{env.version} · GPL-3.0 · no AI, no feeds, no notifications.</p>
    </Card>
  );
}

export default function Settings() {
  return (
    <div className="page" data-section="settings">
      <div className="section-hero">
        <Banner scene="settings" />
        <div className="section-title-row">
          <h1>Settings<span className="accent">.</span></h1>
        </div>
      </div>
      <RouteTabs base="/settings" tabs={TABS} label="Settings sections" />
      <Routes>
        <Route index element={<Navigate to="profile" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="appearance" element={<Appearance />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="public" element={<PublicStats />} />
        <Route path="modules" element={<Modules />} />
        <Route path="targets" element={<TargetsTab />} />
        <Route path="data" element={<Data />} />
        <Route path="account" element={<Account />} />
        <Route path="*" element={<Navigate to="profile" replace />} />
      </Routes>
    </div>
  );
}
