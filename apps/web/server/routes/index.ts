import type { Handler } from "../http.js";
import { json } from "../http.js";
import { video } from "./video.js";
import { news } from "./news.js";
import { linkTitle } from "./linkTitle.js";
import { leetcode } from "./leetcode.js";

export const routes: Record<string, Handler> = {
  "GET /api/health": async () => json({ ok: true, service: "one", time: new Date().toISOString() }),
  "GET /api/video": video,
  "GET /api/news": news,
  "GET /api/link-title": linkTitle,
  "GET /api/leetcode": leetcode,
};
