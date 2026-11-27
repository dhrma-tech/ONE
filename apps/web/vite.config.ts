import { defineConfig, type Connect, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export const SECTIONS = ["career", "mind", "body", "persona"] as const;

/** Rewrites deep links like /career/library to the right HTML entry (one per installable app). */
function sectionFallback(): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const url = (req.url ?? "/").split("?")[0];
    const accept = String(req.headers.accept ?? "");
    if (req.method === "GET" && accept.includes("text/html") && !/\.[a-z0-9]+$/i.test(url)) {
      const s = SECTIONS.find((x) => url === `/${x}` || url.startsWith(`/${x}/`));
      if (s && !url.startsWith(`/${s}/index.html`)) req.url = `/${s}/index.html`;
    }
    next();
  };
}

/** Serves /api/* in dev and preview through the same router the Vercel function uses. */
function devApi(): Plugin {
  const mount = (server: ViteDevServer) => {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();
      try {
        const mod = (await server.ssrLoadModule("/server/node-adapter.ts")) as typeof import("./server/node-adapter");
        await mod.handleNode(req, res);
      } catch (e) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "dev_api_failed", detail: String(e) }));
      }
    });
  };
  return {
    name: "one-dev-api",
    configureServer(server) {
      server.middlewares.use(sectionFallback());
      mount(server);
    },
    configurePreviewServer(server) {
      server.middlewares.use(sectionFallback());
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        career: resolve(__dirname, "career/index.html"),
        mind: resolve(__dirname, "mind/index.html"),
        body: resolve(__dirname, "body/index.html"),
        persona: resolve(__dirname, "persona/index.html"),
      },
    },
  },
});
