// Markdown for the Obsidian mirror. ONE owns these files: every file says so, and ONE overwrites them.
import type { Rows } from "@/data/types.gen";
import { isoWeek } from "@/lib/dates";

const HEADER = "> Managed by ONE. Edits made in Obsidian are overwritten on the next mirror.";

const fm = (o: Record<string, unknown>) =>
  `---\n${Object.entries(o)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(", ")}]` : JSON.stringify(v)}`)
    .join("\n")}\n---\n`;

/** Safe file/folder name (Windows + macOS + Obsidian friendly). */
export const safeName = (s: string, max = 80): string =>
  s
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "") || "untitled";

export const slug = (s: string, max = 50) => safeName(s, max).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "post";

export interface MirrorFile {
  path: string[]; // folders..., file name
  content: string;
}

export function journalFile(r: Rows["daily_reviews"]): MirrorFile {
  const v = (x: unknown) => (x === null || x === undefined || x === "" ? "—" : String(x));
  const content = `${fm({ id: r.id, date: r.date, type: "nightly-review", submitted_at: r.submitted_at })}
${HEADER}

# ${r.date}

| Gym | Calories | Protein | Water | Block 1 | Pushes | Stuck | Outreach | Speaking | Lights out |
|---|---|---|---|---|---|---|---|---|---|
| ${v(r.gym_status)} | ${v(r.calories)} | ${v(r.protein_g)} g | ${v(r.water_ml)} ml | ${v(r.python_block1_min)} min | ${v(r.pushes)} | ${v(r.stuck_min)} min | ${r.outreach_done ? "yes" : "no"} | ${v(r.speaking_min)} min | ${v(r.lights_out_time)} |

## Went well
${v(r.journal_good)}

## Didn't
${v(r.journal_bad)}

## Lesson
${v(r.journal_lesson)}

## Tomorrow's One Thing
${v(r.tomorrow_one_thing)}
`;
  return { path: ["ONE", "Journal", `${r.date}.md`], content };
}

export function weeklyFile(g: Rows["weekly_grades"]): MirrorFile {
  const checks = (g.checks ?? {}) as Record<string, boolean>;
  const list = (a: string[]) => (a.length ? a.map((x) => `- ${x}`).join("\n") : "- —");
  const content = `${fm({ id: g.id, week_start: g.week_start, grade: g.grade, type: "weekly-review" })}
${HEADER}

# ${isoWeek(g.week_start)} · Grade ${g.grade ?? "—"}

## Checks
${Object.entries(checks)
  .map(([k, ok]) => `- [${ok ? "x" : " "}] ${k}`)
  .join("\n")}

## Top 3 wins
${list(g.wins)}

## Top 3 fails
${list(g.fails)}

## Next week's priorities
${list(g.priorities)}
`;
  return { path: ["ONE", "Weekly", `${isoWeek(g.week_start)}.md`], content };
}

export function noteFile(n: Rows["notes"]): MirrorFile {
  const content = `${fm({ id: n.id, topic: n.topic, created: n.created_at.slice(0, 10), updated: n.updated_at.slice(0, 10), next_review: n.next_review_at })}
${HEADER}

# ${n.title}

${n.body_md}
`;
  return { path: ["ONE", "Career", "Notes", safeName(n.topic || "General"), `${safeName(n.title)}.md`], content };
}

export function readingFile(r: Rows["reading_list"]): MirrorFile {
  const content = `${fm({ id: r.id, url: r.url, saved: r.saved_at.slice(0, 10), read: r.read_at?.slice(0, 10) })}
${HEADER}

# ${r.title ?? r.url}

<${r.url}>

**Takeaway:** ${r.takeaway ?? "—"}
`;
  return { path: ["ONE", "Career", "Reading", `${safeName(r.title ?? r.url)}.md`], content };
}

export function bookFile(b: Rows["books"], sessions: Rows["reading_sessions"][]): MirrorFile {
  const rows = [...sessions].sort((a, c) => (a.date < c.date ? -1 : 1));
  const content = `${fm({ id: b.id, author: b.author, status: b.status, started: b.started_at, finished: b.finished_at })}
${HEADER}

# ${b.title}${b.author ? ` · ${b.author}` : ""}

| Date | Pages | Minutes | Lesson |
|---|---|---|---|
${rows.map((s) => `| ${s.date} | ${s.pages ?? ""} | ${s.minutes ?? ""} | ${(s.lesson ?? "").replace(/\|/g, "/")} |`).join("\n")}
`;
  return { path: ["ONE", "Mind", "Books", `${safeName(b.title)}.md`], content };
}

export function postFile(p: Rows["posts"]): MirrorFile {
  const date = p.published_at ?? p.created_at.slice(0, 10);
  const content = `${fm({ id: p.id, platform: p.platform, status: p.status, published: p.published_at, url: p.url })}
${HEADER}

${p.body}
`;
  return { path: ["ONE", "Persona", "Posts", `${date}-${slug(p.body.split("\n")[0] ?? "post")}.md`], content };
}
