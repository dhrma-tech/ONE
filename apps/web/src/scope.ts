import type { SectionId } from "@/lib/sections";

/**
 * Which installable app is running: "master" or one section.
 * Each section manifest launches with start_url "/<section>/?app=<section>". We persist that per window in
 * sessionStorage, so reloading /career/... inside the master app stays in master mode, while the installed
 * Career app stays scoped. The <meta name="one-scope"> tag only selects the manifest.
 */
export type Scope = "master" | SectionId;
const VALID = ["master", "career", "mind", "body", "persona"];

export function readScope(): Scope {
  try {
    const url = new URL(location.href);
    const p = url.searchParams.get("app");
    if (p && VALID.includes(p)) {
      sessionStorage.setItem("one.scope", p);
      url.searchParams.delete("app");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    }
    const s = sessionStorage.getItem("one.scope");
    return (s && VALID.includes(s) ? s : "master") as Scope;
  } catch {
    return "master";
  }
}

export const SCOPE: Scope = typeof document === "undefined" ? "master" : readScope();

/** In a section app, links to other areas leave the app (open the master app). */
export const inScope = (path: string, scope: Scope = SCOPE): boolean =>
  scope === "master" || path === `/${scope}` || path.startsWith(`/${scope}/`) || path.startsWith("/settings");
