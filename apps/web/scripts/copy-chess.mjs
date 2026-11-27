// Copies the BOBBY build (packages/chess/site/dist) into dist/chess-app if it exists. Safe no-op otherwise.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(web, "..", "..", "packages", "chess", "site", "dist");
const dst = join(web, "dist", "chess-app");
if (!existsSync(join(web, "dist"))) process.exit(0);
if (!existsSync(src)) {
  console.log("[copy-chess] packages/chess not built; skipping (run pnpm build:chess)");
  process.exit(0);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log("[copy-chess] copied chess app into dist/chess-app");
