import type { SectionId } from "@/lib/sections";

/** Which installable app is running: "master" or one section (from <meta name="one-scope">). */
export type Scope = "master" | SectionId;

export function readScope(): Scope {
  const v = document.querySelector('meta[name="one-scope"]')?.getAttribute("content") ?? "master";
  return (["career", "mind", "body", "persona"].includes(v) ? v : "master") as Scope;
}

export const SCOPE: Scope = typeof document === "undefined" ? "master" : readScope();

/** In a section app, links to other areas leave the app (open the master app). */
export const inScope = (path: string, scope: Scope = SCOPE): boolean =>
  scope === "master" || path === `/${scope}` || path.startsWith(`/${scope}/`) || path.startsWith("/settings");
