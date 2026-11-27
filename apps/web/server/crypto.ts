// AES-256-GCM for third-party tokens at rest, and HMAC for signed OAuth state. Key: TOKEN_ENCRYPTION_KEY (32 bytes, base64).
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env, HttpError } from "./http.js";

function key(): Buffer {
  const raw = env("TOKEN_ENCRYPTION_KEY");
  const k = raw ? Buffer.from(raw, "base64") : Buffer.alloc(0);
  if (k.length !== 32) throw new HttpError(409, "encryption_key_missing");
  return k;
}

export function encrypt(plain: string, k: Buffer = key()): { ciphertext: string; iv: string; tag: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return { ciphertext: ct.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

export function decrypt(box: { ciphertext: string; iv: string; tag: string }, k: Buffer = key()): string {
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(box.iv, "base64"));
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.ciphertext, "base64")), d.final()]).toString("utf8");
}

/** Signed, expiring state for OAuth: base64url(json).base64url(hmac). */
export function signState(payload: Record<string, unknown>, ttlSec = 600, k: Buffer = key()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec, n: randomBytes(8).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", k).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T extends Record<string, unknown>>(state: string, k: Buffer = key()): T | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", k).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
  if (p.exp < Date.now() / 1000) return null;
  return p;
}
