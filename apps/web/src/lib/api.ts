// Client for ONE's own /api/* (the single Vercel function). Sends the Supabase access token when signed in.
import { auth } from "@/data/supabase";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await auth.token();
  const r = await fetch(path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let j: unknown = null;
  try {
    j = await r.json();
  } catch {
    /* empty body */
  }
  if (!r.ok) throw new ApiError(r.status, (j as { error?: string } | null)?.error ?? `http_${r.status}`);
  return j as T;
}

export const api = {
  get: <T>(path: string) => call<T>("GET", path),
  post: <T>(path: string, body?: unknown) => call<T>("POST", path, body ?? {}),
  del: <T>(path: string) => call<T>("DELETE", path),
};
