// Command palette parser (no AI): "log water 500", "start focus 25", "log weight 52.4", "add task …", etc.
export type Command =
  | { kind: "water"; ml: number }
  | { kind: "weight"; kg: number }
  | { kind: "focus"; minutes: number }
  | { kind: "task"; title: string; section: string; oneThing: boolean }
  | { kind: "protein"; grams: number }
  | { kind: "kcal"; calories: number }
  | { kind: "meditate"; minutes: number }
  | { kind: "english"; minutes: number }
  | { kind: "theme" }
  | { kind: "review" }
  | { kind: "note"; text: string };

const SECTION_TAGS: Record<string, string> = { career: "career", c: "career", mind: "mind", m: "mind", body: "body", b: "body", persona: "persona", p: "persona" };

export function parseCommand(input: string): Command | null {
  const s = input.trim().replace(/\s+/g, " ");
  const l = s.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = l.match(/^(?:log )?water \+?(\d+(?:\.\d+)?)\s*(ml|l)?$/))) {
    const n = Number(m[1]);
    return { kind: "water", ml: Math.round(m[2] === "l" || (n < 10 && !m[2]) ? n * 1000 : n) };
  }
  if ((m = l.match(/^(?:log )?weight (\d{2,3}(?:\.\d+)?)\s*(?:kg)?$/))) return { kind: "weight", kg: Number(m[1]) };
  if ((m = l.match(/^(?:start )?focus(?: (\d{1,3}))?(?: ?min)?$/))) return { kind: "focus", minutes: m[1] ? Number(m[1]) : 25 };
  if ((m = l.match(/^(?:log )?protein (\d{1,3})\s*g?$/))) return { kind: "protein", grams: Number(m[1]) };
  if ((m = l.match(/^(?:log )?(?:kcal|calories|cal) (\d{2,4})$/))) return { kind: "kcal", calories: Number(m[1]) };
  if ((m = l.match(/^(?:log )?(?:meditate|meditation) (\d{1,3})(?: ?min)?$/))) return { kind: "meditate", minutes: Number(m[1]) };
  if ((m = l.match(/^(?:log )?english (\d{1,3})(?: ?min)?$/))) return { kind: "english", minutes: Number(m[1]) };
  if (l === "theme" || l === "toggle theme") return { kind: "theme" };
  if (l === "review" || l === "nightly review") return { kind: "review" };
  if ((m = s.match(/^(?:add )?(one thing|task|todo) (.+)$/i))) {
    let title = m[2];
    let section = "career";
    const tag = title.match(/\s#(\w+)$/);
    if (tag && SECTION_TAGS[tag[1].toLowerCase()]) {
      section = SECTION_TAGS[tag[1].toLowerCase()];
      title = title.slice(0, tag.index).trim();
    }
    return title ? { kind: "task", title, section, oneThing: m[1].toLowerCase() === "one thing" } : null;
  }
  if ((m = s.match(/^note (.+)$/i))) return { kind: "note", text: m[1] };
  return null;
}

export function describe(c: Command): string {
  switch (c.kind) {
    case "water":
      return `Log ${c.ml} ml water`;
    case "weight":
      return `Log weight ${c.kg} kg`;
    case "focus":
      return `Start a ${c.minutes}-minute focus block`;
    case "task":
      return `Add ${c.oneThing ? "One Thing" : "task"} "${c.title}" to ${c.section}`;
    case "protein":
      return `Log ${c.grams} g protein`;
    case "kcal":
      return `Log ${c.calories} kcal`;
    case "meditate":
      return `Log ${c.minutes} min meditation`;
    case "english":
      return `Log ${c.minutes} min English speaking`;
    case "theme":
      return "Toggle theme";
    case "review":
      return "Open the nightly review";
    case "note":
      return `New career note "${c.text}"`;
  }
}

/** Tiny fuzzy match: all query chars appear in order. Returns a score (lower = better) or -1. */
export function fuzzy(q: string, text: string): number {
  const a = q.toLowerCase();
  const b = text.toLowerCase();
  if (!a) return 0;
  const direct = b.indexOf(a);
  if (direct >= 0) return direct;
  let i = 0;
  let gaps = 0;
  for (const ch of b) {
    if (ch === a[i]) i++;
    else if (i > 0) gaps++;
    if (i === a.length) return 100 + gaps;
  }
  return -1;
}
