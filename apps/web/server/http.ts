// Framework-neutral request/response types for the single API function.
// Server files import each other with ".js" extensions so Vercel's per-file TS compile resolves at runtime.

export interface ApiRequest {
  method: string;
  path: string; // e.g. "/api/news"
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
  /** Raw redirect target; when set the adapter sends a 302. */
  redirect?: string;
}

export type Handler = (req: ApiRequest) => Promise<ApiResponse>;

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): ApiResponse => ({
  status,
  body,
  headers: { "content-type": "application/json; charset=utf-8", ...headers },
});

export const env = (k: string): string => (typeof process !== "undefined" ? (process.env[k] ?? "") : "");
