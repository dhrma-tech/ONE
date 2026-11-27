import { useSyncExternalStore } from "react";
let msg: { text: string; id: number } | null = null;
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  msg = { text, id: Date.now() }; subs.forEach((f) => f());
  clearTimeout(timer); timer = setTimeout(() => { msg = null; subs.forEach((f) => f()); }, 3200);
}
export function Toaster() {
  const m = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => msg);
  return <div className="toast-wrap" aria-live="polite">{m ? <div className="toast" key={m.id}>{m.text}</div> : null}</div>;
}
