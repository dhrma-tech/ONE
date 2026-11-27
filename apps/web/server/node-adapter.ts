import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "./router.js";

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) return req.body; // Vercel helpers already parsed it
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1_000_000) throw new Error("body_too_large");
    chunks.push(c as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** Adapts Node's req/res (Vercel function or Vite dev middleware) to the router. */
export async function handleNode(req: IncomingMessage & { body?: unknown }, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://local");
  const forced = url.searchParams.get("__path");
  const path = forced ? `/api/${forced.replace(/^\/+/, "")}` : url.pathname;
  url.searchParams.delete("__path");
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers[k.toLowerCase()] = v;
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res.statusCode = 413;
    res.end();
    return;
  }
  const out = await handle({ method: req.method ?? "GET", path, query: url.searchParams, headers, body });
  if (out.redirect) {
    res.statusCode = 302;
    res.setHeader("location", out.redirect);
    res.end();
    return;
  }
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
  if (out.body === undefined) res.end();
  else if (typeof out.body === "string") res.end(out.body);
  else res.end(JSON.stringify(out.body));
}
