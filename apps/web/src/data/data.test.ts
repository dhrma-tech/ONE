import { db, sqlDefault } from "./db";
import { repo, seedId, setRepoUser } from "./repo";
import { pull, push, syncOnce, type RemoteApi } from "./sync";
import { topoOrder } from "./order";
import type { TableName } from "./schema";
import type { BaseRow } from "./types.gen";

/** In-memory fake Supabase with a server clock and LWW like the SQL trigger. */
function fakeRemote() {
  const store = new Map<string, Map<string, BaseRow>>();
  let clock = 0;
  const tick = () => new Date(Date.UTC(2030, 0, 1) + ++clock * 1000).toISOString();
  const api: RemoteApi & { store: typeof store; serverWrite: (t: TableName, r: BaseRow) => void } = {
    store,
    async upsert(table, rows) {
      const m = store.get(table) ?? new Map();
      store.set(table, m);
      for (const r of rows) {
        const cur = m.get(r.id);
        if (cur && r.updated_at < cur.updated_at) continue;
        m.set(r.id, { ...r, synced_at: tick() });
      }
    },
    async pullSince(table, since, limit) {
      const rows = [...(store.get(table)?.values() ?? [])].filter((r) => !since || (r.synced_at ?? "") > since);
      return rows.sort((a, b) => (a.synced_at! < b.synced_at! ? -1 : 1)).slice(0, limit);
    },
    serverWrite(t, r) {
      const m = store.get(t) ?? new Map();
      store.set(t, m);
      m.set(r.id, { ...r, synced_at: tick() });
    },
  };
  return api;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  setRepoUser(null);
});

describe("schema helpers", () => {
  it("parses SQL defaults", () => {
    expect(sqlDefault({ t: "text", def: "'dark'" })).toBe("dark");
    expect(sqlDefault({ t: "num", def: "2.5" })).toBe(2.5);
    expect(sqlDefault({ t: "bool", def: "true" })).toBe(true);
    expect(sqlDefault({ t: "jsonb", def: "'[]'::jsonb" })).toEqual([]);
    expect(sqlDefault({ t: "int[]", def: "'{1,2,3}'" })).toEqual([1, 2, 3]);
    expect(sqlDefault({ t: "text[]", def: "'{}'" })).toEqual([]);
  });
  it("orders tables parents first", () => {
    const o = topoOrder();
    expect(o.indexOf("path_stages")).toBeLessThan(o.indexOf("path_items"));
    expect(o.indexOf("path_items")).toBeLessThan(o.indexOf("tasks"));
    expect(o.indexOf("subjects")).toBeLessThan(o.indexOf("units"));
  });
  it("makes deterministic seed ids that look like UUIDs", () => {
    expect(seedId("profile")).toBe(seedId("profile"));
    expect(seedId("profile")).not.toBe(seedId("settings"));
    expect(seedId("x")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("repo", () => {
  it("inserts with defaults and queues an outbox entry", async () => {
    const t = await repo.insert("tasks", { section: "career", title: "Block 1" });
    expect(t.priority).toBe(2);
    expect(t.is_one_thing).toBe(false);
    expect(await db.outbox.count()).toBe(1);
  });
  it("upsertBy revives and updates the matching row", async () => {
    const a = await repo.upsertBy("weigh_ins", { date: "2026-11-29" }, { weight_kg: 50.2 });
    await repo.remove("weigh_ins", a.id);
    const b = await repo.upsertBy("weigh_ins", { date: "2026-11-29" }, { weight_kg: 50.6 });
    expect(b.id).toBe(a.id);
    expect(b.deleted_at).toBeNull();
    expect((await db.t("weigh_ins").toArray()).length).toBe(1);
  });
});

describe("sync", () => {
  it("pushes the outbox, then pulls remote changes (LWW)", async () => {
    const remote = fakeRemote();
    const t = await repo.insert("tasks", { section: "mind", title: "Meditate" });
    const r1 = await push(remote, "u1");
    expect(r1.pushed).toBe(1);
    expect(await db.outbox.count()).toBe(0);
    expect(remote.store.get("tasks")!.get(t.id)!.user_id).toBe("u1");

    // Another device edits it later
    remote.serverWrite("tasks", { ...remote.store.get("tasks")!.get(t.id)!, title: "Meditate 10", updated_at: "2099-01-01T00:00:00.000Z" } as unknown as BaseRow);
    const r2 = await pull(remote);
    expect(r2.pulled).toBeGreaterThan(0);
    expect((await db.t("tasks").get(t.id))!.title).toBe("Meditate 10");

    // Pull is incremental: nothing new the second time
    expect((await pull(remote)).pulled).toBe(0);
  });

  it("does not let an older remote row overwrite a newer local one", async () => {
    const remote = fakeRemote();
    const t = await repo.insert("tasks", { section: "body", title: "local newest" });
    remote.serverWrite("tasks", { ...t, title: "old remote", updated_at: "2000-01-01T00:00:00.000Z" } as unknown as BaseRow);
    await pull(remote);
    expect((await db.t("tasks").get(t.id))!.title).toBe("local newest");
  });

  it("bootstraps local-mode rows on first sync and stamps the user", async () => {
    const remote = fakeRemote();
    await repo.insert("water_logs", { date: "2026-11-29", ml: 500 });
    await db.outbox.clear(); // pretend these were created long ago in local mode
    const r = await syncOnce(remote, "u9");
    expect(r.pushed).toBe(1);
    expect([...remote.store.get("water_logs")!.values()][0].user_id).toBe("u9");
    expect((await syncOnce(remote, "u9")).pushed).toBe(0);
  });
});
