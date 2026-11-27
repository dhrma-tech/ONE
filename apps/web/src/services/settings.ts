import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo, seedId } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import { withDefaults, type Targets } from "@/domain/targets";

export async function getSettings(): Promise<Rows["settings"] | undefined> {
  return (await db.t("settings").toArray()).find((r) => !r.deleted_at);
}
export async function getProfile(): Promise<Rows["profile"] | undefined> {
  return (await db.t("profile").toArray()).find((r) => !r.deleted_at);
}

export function useSettings(): Rows["settings"] | undefined {
  return useLiveQuery(getSettings, []);
}
export function useProfile(): Rows["profile"] | undefined {
  return useLiveQuery(getProfile, []);
}
export function useTargets(): Targets {
  const s = useSettings();
  return withDefaults(s?.targets);
}

export async function patchSettings(p: Partial<Rows["settings"]>): Promise<void> {
  const s = await getSettings();
  if (s) await repo.patch("settings", s.id, p);
  else await repo.insert("settings", { id: seedId("settings"), ...p });
}
export async function patchProfile(p: Partial<Rows["profile"]>): Promise<void> {
  const s = await getProfile();
  if (s) await repo.patch("profile", s.id, p);
  else await repo.insert("profile", { id: seedId("profile"), ...p });
}
export async function patchTargets(p: Partial<Targets>): Promise<void> {
  const s = await getSettings();
  await patchSettings({ targets: { ...withDefaults(s?.targets), ...p } });
}
