// Private media (progress photos, speaking recordings, PYQ PDFs): saved to IndexedDB first,
// uploaded by sync to a PRIVATE Supabase bucket under "<user_id>/<object>", read back with short-lived signed URLs.
import { db } from "@/data/db";
import { getSupabase, auth } from "@/data/supabase";

export type Bucket = "progress-photos" | "recordings" | "pyq";

const localKey = (bucket: Bucket, object: string) => `${bucket}/local/${object}`;

export async function saveBlob(bucket: Bucket, object: string, blob: Blob): Promise<void> {
  await db.blobs.put({ path: localKey(bucket, object), bucket, blob, mime: blob.type || "application/octet-stream", uploaded: 0, created_at: new Date().toISOString() });
}

const urlCache = new Map<string, { url: string; until: number }>();

/** Object URL from the local copy, else a 10-minute signed URL. Null if unavailable (offline + not cached). */
export async function blobUrl(bucket: Bucket, object: string): Promise<string | null> {
  const key = localKey(bucket, object);
  const hit = urlCache.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  const local = await db.blobs.get(key);
  if (local) {
    const url = URL.createObjectURL(local.blob);
    urlCache.set(key, { url, until: Number.MAX_SAFE_INTEGER });
    return url;
  }
  const uid = auth.get().userId;
  const supabase = await getSupabase();
  if (!supabase || !uid) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(`${uid}/${object}`, 600);
  if (!data?.signedUrl) return null;
  urlCache.set(key, { url: data.signedUrl, until: Date.now() + 540_000 });
  return data.signedUrl;
}

export async function deleteBlob(bucket: Bucket, object: string): Promise<void> {
  await db.blobs.delete(localKey(bucket, object));
  const uid = auth.get().userId;
  const supabase = await getSupabase();
  if (supabase && uid) await supabase.storage.from(bucket).remove([`${uid}/${object}`]);
}

/** Downscale an image to max 1280px JPEG (keeps storage small on the free tier). */
export async function compressImage(file: File, max = 1280, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", quality));
}
