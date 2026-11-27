import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Pyodide, Stockfish and python-chess are served as static files from public/ (see scripts/prepare-assets.mjs).
// In dev, the bobby package is served live from ../py/bobby so Python edits show up on reload without a re-copy.
const pyBobby = resolve(__dirname, "../py/bobby");
const pubPy = resolve(__dirname, "public/py");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

function livePython(): Plugin {
  return {
    name: "bobby-live-python",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (url === "/py/files.json") {
          const chess = existsSync(join(pubPy, "chess")) ? walk(join(pubPy, "chess")).map((f) => relative(pubPy, f)) : [];
          const bobby = existsSync(pyBobby) ? walk(pyBobby).filter((f) => /\.(py|json)$/.test(f) && !f.includes("__pycache__")).map((f) => "bobby/" + relative(pyBobby, f)) : [];
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify({ files: [...chess, ...bobby].map((f) => f.split("\\").join("/")) }));
          return;
        }
        if (url.startsWith("/py/bobby/")) {
          const f = resolve(pyBobby, decodeURIComponent(url.slice("/py/bobby/".length)));
          if (f.startsWith(pyBobby) && existsSync(f) && statSync(f).isFile()) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "no-store");
            res.end(readFileSync(f));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), livePython()],
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 900, target: "es2022" },
  server: { host: "127.0.0.1", port: 5173 },
});
