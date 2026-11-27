// Compose: LinkedIn and X side by side with counters. Publish via Buffer (server-side key) when connected;
// fallbacks always work: X intent URL, LinkedIn copy-and-open. Every post is logged.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { api, ApiError } from "@/lib/api";
import { LIMITS, LINKEDIN_COMPOSER, postHints, postLength, xIntentUrl } from "@/domain/persona";
import { pretty, today, weekStart } from "@/lib/dates";
import { useTargets } from "@/services/settings";
import { award } from "@/services/xp";
import { useStatus } from "@/services/integrations";
import { Button, Card, Chip, Empty, IconButton, Input, Pager, paginate, Select, Textarea, toast } from "@/ui";

type Platform = "linkedin" | "x";

function Editor({ platform, text, setText }: { platform: Platform; text: string; setText: (s: string) => void }) {
  const n = postLength(platform, text);
  const hints = postHints(platform, text);
  return (
    <div className="stack">
      <div className="row between">
        <span className="micro">{platform === "x" ? "X" : "LinkedIn"}</span>
        <span className={`mono xs char-count${n > LIMITS[platform] ? " over" : ""}`}>{n}/{LIMITS[platform]}</span>
      </div>
      <Textarea aria-label={`${platform} post`} rows={platform === "x" ? 5 : 10} value={text} onChange={(e) => setText(e.target.value)} placeholder={platform === "x" ? "The specific thing that clicked…" : "Hook (not forced). Then the lesson. No hashtags."} />
      {hints.map((h) => <span key={h} className="xs warn-text">{h}</span>)}
    </div>
  );
}

export default function Compose() {
  const t = useTargets();
  const buffer = useStatus("buffer");
  const [li, setLi] = useState("");
  const [x, setX] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const posts = useLiveQuery(async () => (await db.t("posts").toArray()).filter((p) => !p.deleted_at).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)), []);
  const ws = weekStart(today());
  const week = (posts ?? []).filter((p) => p.status === "published" && (p.published_at ?? "") >= ws);

  const log = async (platform: Platform, body: string, status: string, extra: Partial<Rows["posts"]> = {}) => {
    const row = await repo.insert("posts", { platform, body, status, ...(status === "published" ? { published_at: today() } : {}), ...extra });
    if (status === "published") await award("post_published", "persona", "posts", row.id);
    return row;
  };

  const viaBuffer = async (platform: Platform, body: string) => {
    setBusy(true);
    try {
      const r = await api.post<{ id: string }>("/api/buffer/post", { platform, text: body });
      await log(platform, body, "queued", { buffer_id: r.id });
      toast.ok("Queued in Buffer.");
      return true;
    } catch (e) {
      toast.err(e instanceof ApiError && e.status === 409 ? "Buffer not connected. Using the fallback." : "Buffer failed. Using the fallback.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const fallbackX = async (body: string) => {
    window.open(xIntentUrl(body), "_blank", "noopener");
    await log("x", body, "published");
    toast.ok("Opened X. Paste the URL here after posting, if you like.");
  };
  const fallbackLi = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      /* clipboard blocked: user can copy manually */
    }
    window.open(LINKEDIN_COMPOSER, "_blank", "noopener");
    await log("linkedin", body, "published");
    toast.ok("Copied. Paste and post.");
  };

  const { slice, pages } = paginate(posts ?? [], page, 12);
  const connected = buffer?.status === "connected";
  return (
    <div className="bento">
      <Card className="span-12" eyebrow={`This week: ${week.filter((p) => p.platform === "linkedin").length}/${t.posts_linkedin_week} LinkedIn · ${week.filter((p) => p.platform === "x").length}/${t.posts_x_week} X`} title="Compose" right={<Chip tone={connected ? "ok" : undefined} dot>{connected ? "Buffer connected" : "Buffer off · fallbacks on"}</Chip>}>
        <div className="compose">
          <div className="stack">
            <Editor platform="linkedin" text={li} setText={setLi} />
            <div className="row wrap">
              {connected ? <Button variant="accent" disabled={!li.trim() || busy} onClick={async () => { if (await viaBuffer("linkedin", li)) setLi(""); }}>Queue in Buffer</Button> : null}
              <Button disabled={!li.trim()} onClick={async () => { await fallbackLi(li); setLi(""); }}>Copy + open LinkedIn</Button>
              <Button variant="ghost" disabled={!li.trim()} onClick={async () => { await log("linkedin", li, "draft"); setLi(""); toast.ok("Draft saved."); }}>Save draft</Button>
            </div>
            <span className="xs muted">Professional, concise, hook at the start, no hashtags, links in the first comment.</span>
          </div>
          <div className="stack">
            <Editor platform="x" text={x} setText={setX} />
            <div className="row wrap">
              {connected ? <Button variant="accent" disabled={!x.trim() || busy} onClick={async () => { if (await viaBuffer("x", x)) setX(""); }}>Queue in Buffer</Button> : null}
              <Button disabled={!x.trim() || postLength("x", x) > 280} onClick={async () => { await fallbackX(x); setX(""); }}>Open X</Button>
              <Button variant="ghost" disabled={!x.trim()} onClick={async () => { await log("x", x, "draft"); setX(""); toast.ok("Draft saved."); }}>Save draft</Button>
            </div>
            <span className="xs muted">Specific things that clicked. Build in public with demo GIFs. Not "day N of learning".</span>
          </div>
        </div>
      </Card>
      <Card className="span-12" title="Post log">
        <ul className="list">
          {slice.map((p) => (
            <li key={p.id} style={{ flexWrap: "wrap" }}>
              <Chip>{p.platform}</Chip>
              <span className="small text grow truncate" style={{ minWidth: 200 }}>{p.body}</span>
              <Select aria-label="Status" value={p.status} onChange={async (e) => { const s = e.target.value; await repo.patch("posts", p.id, { status: s, ...(s === "published" && !p.published_at ? { published_at: today() } : {}) }); if (s === "published") await award("post_published", "persona", "posts", p.id); }} options={["draft", "queued", "published"].map((s) => ({ value: s, label: s }))} style={{ width: 120, minHeight: 30 }} />
              <Input aria-label="Post URL" placeholder="paste URL" defaultValue={p.url ?? ""} onBlur={(e) => void repo.patch("posts", p.id, { url: e.target.value || null })} style={{ width: 200 }} />
              <span className="mono xs muted">{p.published_at ? pretty(p.published_at) : ""}</span>
              {p.status === "draft" ? <IconButton icon="edit" size="sm" label="Load into editor" onClick={() => (p.platform === "x" ? setX(p.body) : setLi(p.body))} /> : null}
              <IconButton icon="trash" size="sm" label="Delete" onClick={() => void repo.remove("posts", p.id)} />
            </li>
          ))}
        </ul>
        {!posts?.length ? <Empty>No posts yet. The internet won't know you exist.</Empty> : null}
        <Pager page={page} pages={pages} onPage={setPage} total={posts?.length} />
      </Card>
    </div>
  );
}
