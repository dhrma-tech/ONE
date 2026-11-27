// Copies runtime assets into public/ so the app is fully self-hosted and works offline:
//   public/pyodide/   Pyodide runtime (from npm "pyodide")
//   public/engine/    Stockfish lite single-thread WASM (from npm "stockfish", GPL-3.0); no COOP/COEP needed
//   public/py/        python-chess source (pure Python, GPL-3.0) + local bobby package (../py/bobby) + files.json manifest
//   public/data/      shipped JSON data from ../data (if present)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(site, "..");
const pub = join(site, "public");
const nm = join(site, "node_modules");
const CHESS_VERSION = "1.11.2";

const log = (...a) => console.log("[assets]", ...a);
const copy = (src, dst) => { mkdirSync(dirname(dst), { recursive: true }); cpSync(src, dst, { recursive: true, dereference: true }); };
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// 1. Pyodide runtime
const pyo = join(nm, "pyodide");
for (const f of ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"]) copy(join(pyo, f), join(pub, "pyodide", f));
log("pyodide runtime copied");

// 2. Stockfish (single-threaded lite build)
for (const f of ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"]) copy(join(nm, "stockfish", "bin", f), join(pub, "engine", f));
copy(join(nm, "stockfish", "Copying.txt"), join(pub, "engine", "COPYING.txt"));
log("stockfish copied");

// 3. Python packages
const pyOut = join(pub, "py");
const chessDir = join(pyOut, "chess");
if (!existsSync(join(chessDir, "__init__.py"))) {
  // python-chess ships only an sdist; extract the pure-Python package from it.
  const tmp = mkdtempSync(join(tmpdir(), "bobby-chess-"));
  try {
    // ONE: fetch the sdist straight from PyPI with Node (python3 is often missing on Windows); pip as fallback.
    try {
      const meta = await (await fetch(`https://pypi.org/pypi/chess/${CHESS_VERSION}/json`)).json();
      const sdist = meta.urls.find((u) => u.packagetype === "sdist");
      writeFileSync(join(tmp, sdist.filename), Buffer.from(await (await fetch(sdist.url)).arrayBuffer()));
    } catch (e) {
      console.warn("[assets] PyPI fetch failed, trying pip:", e.message);
      execFileSync("python3", ["-m", "pip", "download", `chess==${CHESS_VERSION}`, "--no-deps", "--no-binary", ":all:", "-d", tmp, "-q"], { stdio: "inherit" });
    }
    const tgz = readdirSync(tmp).find((f) => f.endsWith(".tar.gz"));
    execFileSync("tar", ["-xzf", tgz, "-C", "."], { cwd: tmp });
    copy(join(tmp, `chess-${CHESS_VERSION}`, "chess"), chessDir);
    log(`python-chess ${CHESS_VERSION} extracted`);
  } catch (e) {
    console.warn("[assets] could not fetch python-chess; the worker will try micropip at runtime.", e.message);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
const bobbySrc = join(repo, "py", "bobby");
const bobbyDst = join(pyOut, "bobby");
rmSync(bobbyDst, { recursive: true, force: true });
if (existsSync(bobbySrc)) {
  for (const f of walk(bobbySrc)) if (f.endsWith(".py") || f.endsWith(".json")) copy(f, join(bobbyDst, relative(bobbySrc, f)));
}
const files = existsSync(pyOut) ? walk(pyOut).map((f) => relative(pyOut, f).split("\\").join("/")).filter((f) => f !== "files.json" && !f.includes("__pycache__")) : [];
mkdirSync(pyOut, { recursive: true });
writeFileSync(join(pyOut, "files.json"), JSON.stringify({ chess: CHESS_VERSION, files }, null, 0));
log(`python files: ${files.length}`);

// 4. Data
const dataSrc = join(repo, "data");
if (existsSync(dataSrc)) {
  rmSync(join(pub, "data"), { recursive: true, force: true });
  // Cubicle: only the exported catalogue JSON ships; the pipeline's raw/ cache and reports stay in the repo.
  const CUBICLE_SHIP = new Set(["taxonomy.json", "videos.json", "latest.json", "paths.json", "meta.json"]);
  const shipData = (p) => {
    const r = relative(dataSrc, p).split("\\").join("/");
    if (!r.startsWith("cubicle/")) return true; // everything outside cubicle/ ships as before
    return CUBICLE_SHIP.has(r.slice("cubicle/".length)); // only the exported catalogue files, no raw/ or sources
  };
  cpSync(dataSrc, join(pub, "data"), { recursive: true, dereference: true, filter: shipData });
  log("data copied");
}
// 5. Lesson index (the data agent ships one JSON per lesson; the Learn page needs a list).
const lessonDir = join(pub, "data", "lessons");
if (existsSync(lessonDir)) {
  const index = readdirSync(lessonDir).filter((f) => f.endsWith(".json") && f !== "index.json").flatMap((f) => {
    try {
      const l = JSON.parse(readFileSync(join(lessonDir, f), "utf8"));
      return [{ id: l.id ?? f.replace(/\.json$/, ""), title: l.title, section: l.section, order: l.order ?? 999, steps: (l.steps ?? []).length }];
    } catch (e) { console.warn("[assets] bad lesson", f, e.message); return []; }
  }).sort((a, b) => a.order - b.order);
  writeFileSync(join(lessonDir, "index.json"), JSON.stringify(index));
  log(`lesson index: ${index.length}`);
}
