import { HttpError, json, type ApiRequest, type ApiResponse, type Handler } from "./http.js";
import { routes } from "./routes/index.js";

/** Dispatches "/api/<name>" (and nested "/api/google/auth") to a route handler. */
export async function handle(req: ApiRequest): Promise<ApiResponse> {
  const key = `${req.method.toUpperCase()} ${req.path.replace(/\/+$/, "")}`;
  const h: Handler | undefined = routes[key];
  if (!h) return json({ error: "not_found", route: key }, 404);
  try {
    const res = await h(req);
    return { ...res, headers: { "x-content-type-options": "nosniff", ...(res.headers ?? {}) } };
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code }, e.status);
    console.error("[api]", key, e);
    return json({ error: "internal" }, 500);
  }
}
