// Generates ONE's original pixel icons (PNG + SVG) and the 5 web app manifests. No image libraries:
// a tiny PNG encoder (zlib) draws pixel art. Run: node scripts/make-icons.mjs (outputs are committed).
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const APPS = [
  { id: "master", dir: "", name: "ONE", short: "ONE", color: "#fafafa", desc: "One place to lock in." },
  { id: "career", dir: "career", name: "ONE Career", short: "Career", color: "#ffb224", desc: "Career: Python, LLMs, college. Focus mode." },
  { id: "mind", dir: "mind", name: "ONE Mind", short: "Mind", color: "#b69cff", desc: "Mind: chess, meditation, memory." },
  { id: "body", dir: "body", name: "ONE Body", short: "Body", color: "#ff7a6b", desc: "Body: gym, diet, water, weigh-ins." },
  { id: "persona", dir: "persona", name: "ONE Persona", short: "Persona", color: "#4cc3ff", desc: "Persona: speaking, networking, posts." },
];

// 5x7 pixel "1"
const ONE = ["..X..", ".XX..", "X.X..", "..X..", "..X..", "..X..", "XXXXX"];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, draw) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  draw(set);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Black tile, dashed frame with corner marks, pixel "1" in the app colour. `pad` = safe-zone ratio. */
function icon(size, color, pad) {
  const c = hex(color);
  const dim = [40, 40, 44];
  return png(size, (set) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, [0, 0, 0]);
    const inner = Math.round(size * (1 - pad * 2));
    const o = Math.round(size * pad);
    // dashed frame
    const t = Math.max(1, Math.round(size / 96));
    const dash = Math.max(2, Math.round(size / 40));
    for (let i = 0; i < inner; i++) {
      if (Math.floor(i / dash) % 2) continue;
      for (let k = 0; k < t; k++) {
        set(o + i, o + k, dim);
        set(o + i, o + inner - 1 - k, dim);
        set(o + k, o + i, dim);
        set(o + inner - 1 - k, o + i, dim);
      }
    }
    // corner "+" marks
    const arm = Math.round(size / 24);
    for (const [cx, cy] of [[o, o], [o + inner - 1, o], [o, o + inner - 1], [o + inner - 1, o + inner - 1]])
      for (let d = -arm; d <= arm; d++) for (let k = 0; k < t; k++) {
        set(cx + d, cy + k, c);
        set(cx + k, cy + d, c);
      }
    // pixel "1"
    const cell = Math.floor((inner * 0.62) / 7);
    const gw = cell * 5;
    const gh = cell * 7;
    const gx = Math.round((size - gw) / 2);
    const gy = Math.round((size - gh) / 2);
    ONE.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (ch !== "X") return;
      for (let yy = 0; yy < cell; yy++) for (let xx = 0; xx < cell; xx++) set(gx + rx * cell + xx, gy + ry * cell + yy, c);
    }));
  });
}

function svg(color) {
  const cells = ONE.flatMap((row, y) => [...row].map((ch, x) => (ch === "X" ? `<rect x="${10 + x * 2.4}" y="${7.6 + y * 2.4}" width="2.4" height="2.4"/>` : ""))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#000"/><g fill="${color}" shape-rendering="crispEdges">${cells}</g></svg>\n`;
}

for (const a of APPS) {
  const out = join(pub, a.dir);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "icon-192.png"), icon(192, a.color, 0.08));
  writeFileSync(join(out, "icon-512.png"), icon(512, a.color, 0.08));
  writeFileSync(join(out, "icon-maskable-512.png"), icon(512, a.color, 0.18));
  writeFileSync(join(out, "apple-touch-icon.png"), icon(180, a.color, 0.1));
  writeFileSync(join(out, "icon.svg"), svg(a.color));
  const base = a.dir ? `/${a.dir}/` : "/";
  const manifest = {
    id: a.dir ? `/${a.dir}/?app=${a.id}` : "/?app=master",
    name: a.name,
    short_name: a.short,
    description: a.desc,
    start_url: a.dir ? `/${a.dir}/?app=${a.id}` : "/?app=master",
    scope: base,
    display: "standalone",
    display_override: ["standalone"],
    orientation: "any",
    theme_color: "#000000",
    background_color: "#000000",
    categories: ["productivity", "education", "health"],
    icons: [
      { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    ...(a.id === "master"
      ? {
          shortcuts: APPS.slice(1).map((s) => ({ name: s.name, short_name: s.short, url: `/${s.dir}`, icons: [{ src: `/${s.dir}/icon-192.png`, sizes: "192x192", type: "image/png" }] })),
        }
      : {}),
  };
  writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`icons + manifest: ${a.name}`);
}
