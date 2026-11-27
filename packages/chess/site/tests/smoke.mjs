// Headless smoke test against the production build (vite preview).
// Usage: npm run build && npm run smoke   (CHROME=/path/to/chrome to override the browser)
// Covers: board + focus mode, a game vs Bobby + pipeline, stats after a game, a lesson completing, a puzzle solving,
// settings persisting after reload, the rule-based coach answering questions with board arrows, TTS being called (mocked).
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}/`;
const CHROME = process.env.CHROME || ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
const results = [];
// Custom dropdowns (components/Select.tsx): open by label, click the option by value.
const choose = async (label, value) => { await p.locator(`.select-btn[aria-label="${label}"]`).click(); await p.locator(`.select-pop [data-value="${value}"]`).click(); };
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`); };

const server = spawn(process.execPath, [join(site, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { cwd: site, stdio: "pipe" });
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error("preview did not start")), 20000);
  server.stdout.on("data", (d) => { if (String(d).includes(String(PORT))) { clearTimeout(t); res(); } });
  server.on("exit", (c) => rej(new Error("preview exited " + c)));
});

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Mock speechSynthesis so TTS calls can be observed in a headless browser.
await ctx.addInitScript(() => {
  window.__spoken = [];
  const synth = {
    speak: (u) => window.__spoken.push({ text: u.text, rate: u.rate, pitch: u.pitch }), cancel: () => {}, pause: () => {}, resume: () => {},
    getVoices: () => [], addEventListener: () => {}, removeEventListener: () => {}, speaking: false, pending: false, paused: false,
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  if (!window.SpeechSynthesisUtterance) window.SpeechSynthesisUtterance = function (t) { this.text = t; };
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, String(e.message).split("\n")[0].slice(0, 200)); } };
const clickSq = async (sq) => { await p.click(`[data-square="${sq}"]`); await p.waitForTimeout(80); };

let gameId = null;

await step("play: board, focus mode default on, game vs Bobby, pipeline", async () => {
  await p.goto(BASE + "#/");
  await p.waitForSelector('[data-square="e2"]', { timeout: 30000 });
  const lvl = p.locator(".level", { hasText: "Know the moves" });
  if (await lvl.count()) await lvl.click();
  await p.waitForFunction(() => document.querySelector(".top-r")?.textContent?.includes("Loading core") === false, null, { timeout: 90000 });
  await p.waitForTimeout(600);
  await clickSq("e2"); await clickSq("e4");
  await p.waitForFunction(() => document.querySelectorAll(".moves .mv").length >= 2, null, { timeout: 30000 });
  const focusNote = await p.locator('[data-testid="focus-note"]').count();
  const evalbars = await p.locator(".evalbar").count();
  const askDisabled = (await p.locator('[data-testid="coach-locked"]').count()) === 1;
  check("focus mode on by default: eval + coach hidden during game", focusNote === 1 && evalbars === 0 && askDisabled, `note=${focusNote} evalbar=${evalbars} askDisabled=${askDisabled}`);
  await clickSq("d2"); await clickSq("d4");
  await p.waitForFunction(() => document.querySelectorAll(".moves .mv").length >= 4, null, { timeout: 30000 });
  await p.getByRole("button", { name: "Resign" }).click();
  await p.getByRole("button", { name: "Open review" }).waitFor({ timeout: 120000 });
  check("eval returns after game ends", (await p.locator(".evalbar").count()) === 1);
  await p.getByRole("button", { name: "Open review" }).click();
  await p.waitForURL(/#\/review\//);
  gameId = p.url().split("#/review/")[1];
  await p.waitForSelector(".acc", { timeout: 60000 });
  check("game played and analysed", !!gameId);
});

await step("review: every move is explained automatically (rule-based)", async () => {
  await p.locator(".moves .mv").first().click();
  const t = p.locator('[data-testid="explain-text"]');
  await t.waitFor({ timeout: 30000 });
  check("per-move explanation", (await t.textContent()).includes("You played"), (await t.textContent()).slice(0, 80));
});

await step("stats renders after a game", async () => {
  await p.goto(BASE + "#/stats");
  await p.waitForSelector('[data-testid="history"] tbody tr', { timeout: 30000 });
  await p.waitForSelector('[data-testid="benchmarks"] tbody tr', { timeout: 30000 }).catch(() => {});
  const rows = await p.locator('[data-testid="history"] tbody tr').count();
  const ratingPts = await p.locator('[data-testid="chart-rating"] circle').count();
  const accPts = await p.locator('[data-testid="chart-accuracy"] circle').count();
  const bench = await p.locator('[data-testid="benchmarks"] tbody tr').count();
  check("stats: history, rating + accuracy charts, benchmarks", rows >= 1 && ratingPts >= 1 && accPts >= 1 && bench >= 1, `rows=${rows} rating=${ratingPts} acc=${accPts} bench=${bench}`);
});

await step("lesson completes", async () => {
  const id = "pawn-moves";
  await p.goto(BASE + `#/learn?l=${id}`);
  await p.waitForSelector(`[data-lesson-id="${id}"]`, { timeout: 30000 });
  const lesson = await p.evaluate(async (i) => (await fetch(`./data/lessons/${i}.json`)).json(), id);
  for (let i = 0; i < lesson.steps.length; i++) {
    const st = lesson.steps[i];
    await p.waitForSelector(`[data-lesson-id="${id}"][data-step="${i}"]`, { timeout: 10000 });
    if (st.type === "info") await p.locator(".panel").getByRole("button", { name: "Continue", exact: true }).click();
    else if (st.type === "move") { await clickSq(st.correct[0].slice(0, 2)); await clickSq(st.correct[0].slice(2, 4)); }
    else if (st.type === "square") await clickSq(st.correct[0]);
    else if (st.type === "quiz") await p.locator(".qopt", { hasText: st.correct[0] }).first().click();
    await p.locator('[data-testid="lesson-continue"]').click({ timeout: 10000 });
  }
  await p.locator('[data-testid="lesson-complete"]').waitFor({ timeout: 10000 });
  await p.goto(BASE + "#/learn");
  await p.waitForSelector(`[data-lesson="${id}"]`);
  check("lesson completes and shows as done", await p.locator(`[data-lesson="${id}"].done`).count() === 1);
});

await step("puzzle solves", async () => {
  await p.goto(BASE + "#/train?tab=puzzles&set=themed&theme=mateIn2");
  const el = p.locator("[data-puzzle-id]");
  await el.waitFor({ timeout: 60000 });
  const pid = await el.getAttribute("data-puzzle-id");
  const sol = await p.evaluate(async (i) => (await (await fetch("./data/puzzles.json")).json()).find((x) => x.id === i).solution, pid);
  for (let i = 0; i < sol.length; i += 2) {
    await clickSq(sol[i].slice(0, 2)); await clickSq(sol[i].slice(2, 4));
    if (i + 1 < sol.length) await p.waitForTimeout(700);
  }
  await p.waitForSelector('[data-puzzle-id][data-state="solved"]', { timeout: 10000 });
  check("themed puzzle solved", true, `${pid} ${sol.join(" ")}`);
});

await step("settings persist after reload", async () => {
  await p.goto(BASE + "#/");
  await p.waitForSelector('[data-square="e2"]');
  await p.getByRole("button", { name: "Settings" }).click();
  await choose("Board theme", "brown");
  await choose("Piece set", "glyph");
  await p.getByLabel(/Safety net/).uncheck();
  await p.locator('input[aria-label="Strength offset"]').fill("100");
  await p.reload();
  await p.waitForSelector('[data-square="e2"]');
  await p.getByRole("button", { name: "Settings" }).click();
  const board = await p.getAttribute('.select-btn[aria-label="Board theme"]', "data-value");
  const pieces = await p.getAttribute('.select-btn[aria-label="Piece set"]', "data-value");
  const safety = await p.getByLabel(/Safety net/).isChecked();
  const off = await p.inputValue('input[aria-label="Strength offset"]');
  check("settings persisted", board === "brown" && pieces === "glyph" && !safety && off === "100", `${board} ${pieces} safety=${safety} ${off}`);
  await p.getByLabel(/Safety net/).check();
  await p.getByLabel("Speak coach answers aloud").check();
  await p.keyboard.press("Escape");
});

await step("coach answers questions with arrows on the board + TTS", async () => {
  await p.goto(BASE + `#/review/${gameId}`);
  await p.waitForSelector(".acc", { timeout: 30000 });
  const ask = async (label) => {
    const n = await p.locator(".msg.bobby").count();
    await p.locator(".qbtn", { hasText: label }).click();
    await p.waitForFunction((k) => document.querySelectorAll(".msg.bobby").length > k, n, { timeout: 30000 });
    return (await p.locator(".msg.bobby p").last().textContent()) ?? "";
  };
  const best = await ask("best move");
  check("best move answer with reason", best.includes("Best move:") && best.includes("Why:"), best.slice(0, 90));
  const arrows = await p.locator(".board svg line, .board svg path").count();
  check("answer draws on the board", arrows > 0, `svg marks=${arrows}`);
  const danger = await ask("in danger");
  check("danger answer", danger.length > 10, danger.slice(0, 80));
  const spoken = await p.evaluate(() => window.__spoken);
  check("TTS speak() called for coach answers", spoken.length >= 2, `calls=${spoken.length}`);
});

await step("scroll: video library", async () => {
  // Thumbnails must be frames from inside the video (hq1/hq2/hq3), never the uploader's high-res cover.
  const covers = [];
  const onReq = (r) => { if (/ytimg\.com\/vi\/[^/]+\/(maxresdefault|sddefault|hq720)/.test(r.url())) covers.push(r.url()); };
  p.on("request", onReq);
  await p.goto(BASE + "#/scroll");
  await p.waitForSelector(".cubicle", { timeout: 30000 });
  const meta = await p.evaluate(async () => { try { return await (await fetch("./data/cubicle/meta.json")).json(); } catch { return {}; } });
  const total = await p.evaluate(async () => { try { return (await (await fetch("./data/cubicle/videos.json")).json()).videos.length; } catch { return 0; } });
  check("scroll catalogue has at least 500 videos", total >= 500, `videos=${total}${meta.keyless ? " (key-less build: run the pipeline with YT_API_KEY)" : ""}`);
  await p.waitForSelector('[data-testid="cubicle-list"]', { timeout: 15000 });
  // Show every level so the count is the full list, then narrow to one level.
  for (const l of ["b", "i", "a", "x"]) { const b = p.locator(`[data-testid="lv-${l}"]`); if ((await b.getAttribute("aria-pressed")) !== "true") await b.click(); }
  const count = async () => Number(await p.locator('[data-testid="cubicle-list"]').getAttribute("data-count"));
  const all = await count();
  for (const l of ["i", "a", "x"]) await p.locator(`[data-testid="lv-${l}"]`).click();
  const beginners = await count();
  check("scroll filters change the row count", all > 0 && beginners < all, `all=${all} beginner=${beginners}`);
  for (const l of ["i", "a", "x"]) await p.locator(`[data-testid="lv-${l}"]`).click();
  await p.waitForTimeout(1500);
  const thumbs = await p.locator(".cubicle .thumb img").evaluateAll((els) => els.map((e) => e.getAttribute("src") || ""));
  const frames = thumbs.filter((u) => /\/hq[123]\.jpg$/.test(u)).length;
  check("scroll thumbnails are frames from the video timeline", thumbs.length > 0 && frames / thumbs.length >= 0.9, `frames=${frames}/${thumbs.length}`);
  // Save the first card, reload, and find it under Saved.
  const first = p.locator('[data-testid="cubicle-list"] .yt').first();
  const vid = await first.getAttribute("data-video");
  await first.locator(".yt-thumbwrap").hover(); await first.getByRole("button", { name: "Save", exact: true }).click();
  await p.waitForTimeout(700);
  await p.reload(); await p.waitForSelector(".cubicle");
  await p.goto(BASE + "#/scroll?tab=saved"); await p.waitForSelector(`.row[data-video="${vid}"]`, { timeout: 10000 });
  check("scroll saved items survive reload", true, vid);
  // Watch page: official nocookie embed; focus mode hides the side panel and the vouch box.
  await p.goto(BASE + `#/scroll/watch/${vid}`);
  await p.waitForSelector('[data-testid="cubicle-embed"]');
  check("scroll never loads the uploader's high-res covers", covers.length === 0, covers.slice(0, 2).join(" "));
  const src = await p.locator('[data-testid="cubicle-embed"]').getAttribute("src");
  check("scroll plays through the youtube-nocookie embed", src.startsWith("https://www.youtube-nocookie.com/embed/"), src.slice(0, 60));
  const sideBefore = await p.locator('[data-testid="watch-side"]').count();
  await p.locator('[data-testid="focus-btn"]').click();
  const sideAfter = await p.locator('[data-testid="watch-side"]').count();
  const vouchAfter = await p.locator('[data-testid="vouch-box"]').count();
  check("scroll focus mode hides the side panel", sideBefore === 1 && sideAfter === 0 && vouchAfter === 0, `before=${sideBefore} after=${sideAfter}`);
  await p.locator('[data-testid="focus-btn"]').click();
  // Export includes Cubicle state.
  await p.getByRole("button", { name: "Settings" }).click();
  const [dl] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Export", exact: true }).click()]);
  const blob = JSON.parse(await (await import("node:fs/promises")).readFile(await dl.path(), "utf8"));
  const cstate = blob?.data?.cubicle?.[0]?.value;
  check("export contains Scroll state", !!cstate && Array.isArray(cstate.saved) && cstate.saved.includes(vid), `saved=${cstate?.saved?.length}`);
  await p.keyboard.press("Escape");
  p.off("request", onReq);
});

await step("other pages render", async () => {
  for (const t of ["endgames", "openings", "tricks", "challenges"]) {
    await p.goto(BASE + `#/train?tab=${t}`);
    await p.waitForTimeout(1500);
  }
  await p.goto(BASE + "#/train?tab=openings");
  await p.waitForSelector('[data-testid="opening-name"]');
  await clickSq("e2"); await clickSq("e4"); await clickSq("c7"); await clickSq("c5");
  await p.waitForFunction(() => /Sicilian/.test(document.querySelector('[data-testid="opening-name"]')?.textContent ?? ""), null, { timeout: 15000 });
  check("opening explorer names 1.e4 c5 live", true);
  await p.goto(BASE + "#/train?tab=challenges");
  await p.waitForSelector(".plan li", { timeout: 20000 });
  const streak = Number(await p.textContent('[data-testid="streak"]'));
  check("challenges: plan + streak after training today", streak >= 1, `streak=${streak}`);
});

const bad = errors.filter((e) => !/favicon|ERR_FILE_NOT_FOUND|benchmarks\.json/.test(e));
check("no page errors", bad.length === 0, bad.slice(0, 3).join(" | ").slice(0, 300));
await p.screenshot({ path: join(site, "test-results", "smoke.png") }).catch(() => {});
await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
