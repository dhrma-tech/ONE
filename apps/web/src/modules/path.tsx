// Path engine editor: lanes → stages (with gates) → items. Reorder, add, tick items, pass gates.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/data/db";
import { repo } from "@/data/repo";
import type { Rows } from "@/data/types.gen";
import type { SectionId } from "@/lib/sections";
import { award } from "@/services/xp";
import { Button, Chip, Empty, Icon, IconButton, Input, Modal, ProgressBar, Textarea, toast } from "@/ui";

export function usePath(section: SectionId) {
  return useLiveQuery(async () => {
    const stages = (await db.t("path_stages").where("section").equals(section).toArray())
      .filter((s) => !s.deleted_at)
      .sort((a, b) => a.order_no - b.order_no);
    const items = (await db.t("path_items").where("section").equals(section).toArray())
      .filter((i) => !i.deleted_at)
      .sort((a, b) => a.order_no - b.order_no);
    return { stages, items };
  }, [section]);
}

async function swap<K extends "path_stages" | "path_items">(table: K, list: Rows[K][], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  const a = list[i];
  const b = list[j];
  await repo.patch(table, a.id, { order_no: b.order_no === a.order_no ? a.order_no + dir : b.order_no } as never);
  await repo.patch(table, b.id, { order_no: a.order_no } as never);
}

function StageCard({
  stage,
  items,
  idx,
  list,
}: {
  stage: Rows["path_stages"];
  items: Rows["path_items"][];
  idx: number;
  list: Rows["path_stages"][];
}) {
  const [newItem, setNewItem] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(stage.status === "active");
  const [draft, setDraft] = useState({
    title: stage.title,
    description: stage.description ?? "",
    gate_criteria: stage.gate_criteria ?? "",
  });
  const done = items.filter((i) => i.status === "done").length;
  const passed = !!stage.gate_passed_at;
  return (
    <article className={`stage${stage.status === "active" ? " active" : ""}${stage.status === "done" ? " done" : ""}`}>
      <div className="row between">
        <div className="stack tight" style={{ minWidth: 0 }}>
          <span className="micro">
            {stage.target_week ? `Week ${stage.target_week}` : "Later"} · {stage.status}
          </span>
          <h3 style={{ fontSize: "var(--fs-md)" }}>{stage.title}</h3>
        </div>
        <div className="row">
          <IconButton
            icon="up"
            size="sm"
            label="Move stage up"
            onClick={() => void swap("path_stages", list, idx, -1)}
          />
          <IconButton
            icon="down"
            size="sm"
            label="Move stage down"
            onClick={() => void swap("path_stages", list, idx, 1)}
          />
          <IconButton icon="edit" size="sm" label="Edit stage" onClick={() => setEditing(true)} />
          <IconButton
            icon={open ? "chevronDown" : "chevron"}
            size="sm"
            label={open ? "Collapse stage" : "Expand stage"}
            onClick={() => setOpen((o) => !o)}
          />
        </div>
      </div>
      {stage.description ? (
        <p className="xs muted text" style={{ marginTop: 6 }}>
          {stage.description}
        </p>
      ) : null}
      <div style={{ margin: "10px 0" }}>
        <ProgressBar value={items.length ? done / items.length : 0} label={`${stage.title} progress`} />
      </div>
      {open ? (
        <>
          <ul className="checklist">
            {items.map((it, i) => (
              <li key={it.id} className={`check-row${it.status === "done" ? " done" : ""}`}>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={it.status === "done"}
                  aria-label={it.title}
                  onChange={(e) =>
                    void repo.patch("path_items", it.id, {
                      status: e.target.checked ? "done" : "todo",
                      done_at: e.target.checked ? new Date().toISOString() : null,
                    })
                  }
                />
                <span className="check-label grow small">{it.title}</span>
                <IconButton
                  icon="up"
                  size="sm"
                  label="Move item up"
                  onClick={() => void swap("path_items", items, i, -1)}
                />
                <IconButton
                  icon="trash"
                  size="sm"
                  label="Delete item"
                  onClick={() => void repo.remove("path_items", it.id)}
                />
              </li>
            ))}
          </ul>
          <form
            className="row"
            style={{ marginTop: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newItem.trim()) return;
              void repo.insert("path_items", {
                stage_id: stage.id,
                section: stage.section,
                title: newItem.trim(),
                order_no: (items.at(-1)?.order_no ?? 0) + 1,
                target_week: stage.target_week,
              });
              setNewItem("");
            }}
          >
            <Input
              aria-label="New item"
              placeholder="Add item…"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
          </form>
          {stage.gate_criteria ? (
            <div className="gate">
              <Icon name="flag" size={14} />
              <span className="grow">
                <strong>Gate:</strong> {stage.gate_criteria}
              </span>
              {passed ? (
                <Chip tone="ok">passed</Chip>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    await repo.patch("path_stages", stage.id, {
                      gate_passed_at: new Date().toISOString(),
                      status: "done",
                    });
                    const next = list.find((s, j) => j > idx && s.lane === stage.lane && s.status === "todo");
                    if (next) await repo.patch("path_stages", next.id, { status: "active" });
                    await award("gate_passed", stage.section, "path_stages", stage.id);
                    toast.ok("Gate passed.", next ? `Next: ${next.title}` : "Lane complete.");
                  }}
                >
                  Pass gate
                </Button>
              )}
            </div>
          ) : (
            <div className="row" style={{ marginTop: 8 }}>
              {stage.status !== "done" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void repo.patch("path_stages", stage.id, { status: stage.status === "active" ? "done" : "active" })
                  }
                >
                  {stage.status === "active" ? "Mark stage done" : "Make active"}
                </Button>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <span className="xs muted">
          {done}/{items.length} items{stage.gate_criteria ? " · gate" : ""}
          {passed ? " · passed" : ""}
        </span>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit stage">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await repo.patch("path_stages", stage.id, {
              title: draft.title,
              description: draft.description || null,
              gate_criteria: draft.gate_criteria || null,
            });
            setEditing(false);
          }}
        >
          <Input label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <Textarea
            label="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <Input
            label="Gate criteria"
            value={draft.gate_criteria}
            onChange={(e) => setDraft({ ...draft, gate_criteria: e.target.value })}
          />
          <div className="row">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await repo.remove("path_stages", stage.id);
                setEditing(false);
              }}
            >
              Delete stage
            </Button>
          </div>
        </form>
      </Modal>
    </article>
  );
}

/** Lanes side by side (e.g. Python lane + LLM lane). */
export function PathEditor({ section, lanes }: { section: SectionId; lanes: { id: string; label: string }[] }) {
  const p = usePath(section);
  const [adding, setAdding] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  if (!p) return <div className="skeleton" style={{ minHeight: 900 }} aria-busy="true" />;
  return (
    <div className={lanes.length > 1 ? "cols-2" : "stack"} style={{ alignItems: "start" }}>
      {lanes.map((lane) => {
        const stages = p.stages.filter((s) => s.lane === lane.id);
        return (
          <section key={lane.id} className="lane" aria-label={lane.label}>
            <div className="row between">
              <span className="micro accent">{lane.label}</span>
              <Button size="sm" icon="plus" variant="ghost" onClick={() => setAdding(lane.id)}>
                Stage
              </Button>
            </div>
            {stages.length ? (
              stages.map((s, i) => (
                <StageCard
                  key={s.id}
                  stage={s}
                  idx={i}
                  list={stages}
                  items={p.items.filter((it) => it.stage_id === s.id)}
                />
              ))
            ) : (
              <Empty>No stages yet.</Empty>
            )}
          </section>
        );
      })}
      <Modal open={!!adding} onClose={() => setAdding(null)} title="New stage">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const last = p.stages.filter((s) => s.lane === adding).at(-1);
            await repo.insert("path_stages", {
              section,
              lane: adding!,
              title: title.trim(),
              order_no: (last?.order_no ?? 0) + 1,
              target_week: last?.target_week ? last.target_week + 1 : null,
            });
            setTitle("");
            setAdding(null);
          }}
        >
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Button type="submit" variant="primary">
            Add stage
          </Button>
        </form>
      </Modal>
    </div>
  );
}
