import type { Handler } from "../http.js";
import { json } from "../http.js";
import { supabaseConfigured } from "../auth.js";
import { video } from "./video.js";
import { news } from "./news.js";
import { linkTitle } from "./linkTitle.js";
import { leetcode } from "./leetcode.js";
import { chesscom } from "./chesscom.js";
import { github } from "./github.js";
import { authUrl, callback, disconnect, events, push } from "./google.js";
import { bufferChannels, bufferPost } from "./buffer.js";
import { publicStats, publicStatsOptions } from "./publicStats.js";
import { cronDaily } from "./cron.js";
import { env } from "../http.js";

/** Which integrations the server is configured for (no secrets, just booleans). */
const config: Handler = async () =>
  json({
    supabase: supabaseConfigured(),
    google: !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET") && env("GOOGLE_REDIRECT_URI")),
    github: !!env("GITHUB_TOKEN"),
    youtube: !!env("YOUTUBE_API_KEY"),
    buffer: !!env("BUFFER_ACCESS_TOKEN"),
    chesscom_contact: !!env("CHESSCOM_USER_AGENT_CONTACT"),
    encryption: !!env("TOKEN_ENCRYPTION_KEY"),
    owner: !!env("ONE_OWNER_USER_ID"),
  });

export const routes: Record<string, Handler> = {
  "GET /api/health": async () => json({ ok: true, service: "one", time: new Date().toISOString() }),
  "GET /api/config": config,
  "GET /api/video": video,
  "GET /api/news": news,
  "GET /api/link-title": linkTitle,
  "GET /api/leetcode": leetcode,
  "GET /api/chesscom": chesscom,
  "GET /api/github": github,
  "POST /api/google/auth-url": authUrl,
  "GET /api/google/callback": callback,
  "GET /api/google/events": events,
  "POST /api/google/push": push,
  "POST /api/google/disconnect": disconnect,
  "GET /api/buffer/channels": bufferChannels,
  "POST /api/buffer/post": bufferPost,
  "GET /api/public-stats": publicStats,
  "OPTIONS /api/public-stats": publicStatsOptions,
  "GET /api/cron/daily": cronDaily,
};
