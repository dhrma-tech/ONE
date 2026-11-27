// YouTube IFrame Player API over postMessage (adapted from Cubicle's player.ts, MIT).
// Talks to a youtube-nocookie.com embed with enablejsapi=1, so no third-party script is loaded (tight CSP).
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface PlayerOpts {
  onEnd?: () => void;
  onTick?: (time: number, dur: number) => void;
  onState?: (state: number) => void; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
}

export function embedUrl(id: string, start = 0): string {
  const origin = typeof location !== "undefined" ? location.origin : "";
  const p = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    color: "white",
    origin,
    widget_referrer: origin,
  });
  if (start > 5) p.set("start", String(Math.floor(start)));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${p}`;
}

export function usePlayer(ref: RefObject<HTMLIFrameElement>, vid: string, o: PlayerOpts) {
  const opts = useRef(o);
  opts.current = o;
  const [state, setState] = useState(-1);
  const live = useRef({ t: 0, d: 0, st: -1 });

  const send = useCallback(
    (func: string, args: unknown[] = []) => {
      ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
    },
    [ref],
  );

  useEffect(() => {
    live.current = { t: 0, d: 0, st: -1 };
    setState(-1);
    const f = ref.current;
    if (!f) return;
    let heard = false;
    const hello = () => f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    const iv = setInterval(() => {
      if (!heard) hello();
    }, 400);
    f.addEventListener("load", hello);
    const onMsg = (e: MessageEvent) => {
      if (e.source !== f.contentWindow || typeof e.data !== "string") return;
      if (!/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(e.origin)) return;
      let j: { event?: string; info?: Record<string, number> | number };
      try {
        j = JSON.parse(e.data);
      } catch {
        return;
      }
      heard = true;
      const L = live.current;
      const apply = (st: number) => {
        if (st === L.st) return;
        L.st = st;
        setState(st);
        opts.current.onState?.(st);
        if (st === 0) opts.current.onEnd?.();
      };
      if (j.event === "onStateChange" && typeof j.info === "number") apply(j.info);
      if (j.event === "infoDelivery" && j.info && typeof j.info === "object") {
        const i = j.info;
        if (typeof i.currentTime === "number") L.t = i.currentTime;
        if (typeof i.duration === "number" && i.duration > 0) L.d = i.duration;
        if (typeof i.playerState === "number") apply(i.playerState);
        if (typeof i.currentTime === "number") opts.current.onTick?.(L.t, L.d);
      }
    };
    addEventListener("message", onMsg);
    return () => {
      clearInterval(iv);
      f.removeEventListener("load", hello);
      removeEventListener("message", onMsg);
    };
  }, [ref, vid]);

  return {
    state,
    play: () => send("playVideo"),
    pause: () => send("pauseVideo"),
    seek: (s: number) => {
      send("seekTo", [s, true]);
      send("playVideo");
    },
    now: () => live.current.t,
    duration: () => live.current.d,
  };
}

/** ≥ 90% watched counts as done. */
export const isWatched = (t: number, d: number): boolean => d > 0 && t / d >= 0.9;
