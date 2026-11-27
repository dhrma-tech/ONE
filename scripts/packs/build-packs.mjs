// Builds compact "candidate packs" for the Library Inbox from Cubicle and BOBBY's catalogues.
// Input: _ref/Cubicle (MIT) and _ref/BOBBY (GPL-3.0) clones. Output: apps/web/public/packs/*.json (committed).
// Nothing in a pack is approved: Dharma approves videos one by one in the Inbox.
// Run: node scripts/packs/build-packs.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "apps", "web", "public", "packs");
mkdirSync(out, { recursive: true });
const read = (p) => JSON.parse(readFileSync(join(root, "_ref", p), "utf8"));

function pack({ videos, taxonomy, section, perNode, name, source }) {
  const nodes = [];
  for (const s of taxonomy.sections) for (const n of s.nodes) nodes.push({ id: n.id, title: n.title, group: s.title });
  const byNode = new Map();
  for (const v of videos) {
    if (!v.i || !/^[\w-]{11}$/.test(v.i)) continue;
    const list = byNode.get(v.n) ?? [];
    list.push(v);
    byNode.set(v.n, list);
  }
  const rows = [];
  for (const n of nodes) {
    const list = (byNode.get(n.id) ?? []).sort((a, b) => (b.sc ?? 0) - (a.sc ?? 0)).slice(0, perNode);
    for (const v of list) rows.push([v.i, v.t, v.c ?? "", v.d ?? 0, n.id]);
  }
  const topics = nodes.filter((n) => rows.some((r) => r[4] === n.id));
  const data = { v: 1, name, source, section, built: new Date().toISOString().slice(0, 10), topics, videos: rows };
  writeFileSync(join(out, `${name}.json`), JSON.stringify(data));
  console.log(`${name}: ${rows.length} videos, ${topics.length} topics`);
}

pack({ videos: read("Cubicle/site/public/data/videos.json"), taxonomy: read("Cubicle/site/public/data/taxonomy.json"), section: "career", perNode: 6, name: "cubicle-career", source: "Cubicle (MIT)" });
const bobby = read("BOBBY/data/cubicle/videos.json");
pack({ videos: bobby.videos ?? bobby, taxonomy: read("BOBBY/data/cubicle/taxonomy.json"), section: "mind", perNode: 20, name: "bobby-chess", source: "BOBBY Scroll (GPL-3.0)" });
