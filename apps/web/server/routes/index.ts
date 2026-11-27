import type { Handler } from "../http.js";
import { json } from "../http.js";
import { video } from "./video.js";

export const routes: Record<string, Handler> = {
  "GET /api/health": async () => json({ ok: true, service: "one", time: new Date().toISOString() }),
  "GET /api/video": video,
};
