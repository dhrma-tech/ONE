import type { ReactNode } from "react";
import { SCENES } from "@/art/scenes";
import { useAnimGate } from "./hooks";
import { Icon } from "./icons";
import { Link } from "react-router-dom";

export type SceneId = keyof typeof SCENES;

/** Animated pixel scene banner. Loops pause when off-screen or the tab is hidden. */
export function Banner({ scene, children, label }: { scene: SceneId; children?: ReactNode; label?: string }) {
  const [ref, anim] = useAnimGate<HTMLDivElement>();
  const Scene = SCENES[scene];
  return (
    <div ref={ref} className="banner" data-anim={anim} data-section={scene}>
      <Scene />
      {label ? <span className="banner-label micro">{label}</span> : null}
      {children}
    </div>
  );
}

/** Focus timer strip: "> 25:00 _ [Run]". Presentational; logic lives in modules/focus. */
export function TerminalStrip({
  label,
  time,
  running,
  onRun,
  onStop,
  children,
}: {
  label: string;
  time: string;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`terminal${running ? " running" : ""}`} role="timer" aria-live="off" aria-label={`${label} ${time}`}>
      <span className="prompt" aria-hidden>
        &gt;
      </span>
      <span className="grow truncate">
        {label} {running ? <span className="cursor" aria-hidden /> : null}
      </span>
      <span className="time">{time}</span>
      {children}
      {running ? (
        <button type="button" className="btn sm danger" onClick={onStop}>
          <Icon name="stop" size={12} /> Stop
        </button>
      ) : (
        <button type="button" className="btn sm accent" onClick={onRun}>
          <Icon name="play" size={12} /> Run
        </button>
      )}
    </div>
  );
}

/** Footer with the curved notch. */
export function Footer({ day, version }: { day: number | null; version: string }) {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <h4>Navigate</h4>
          <Link to="/">Home</Link>
          <Link to="/career">Career</Link>
          <Link to="/mind">Mind</Link>
          <Link to="/body">Body</Link>
          <Link to="/persona">Persona</Link>
        </div>
        <div>
          <h4>Do</h4>
          <Link to="/career/path">Today's path</Link>
          <Link to="/review/week">Weekly review</Link>
          <Link to="/settings/data">Export data</Link>
          <Link to="/settings">Settings</Link>
        </div>
        <div>
          <h4>Keys</h4>
          <span className="small muted">
            <kbd>Ctrl</kbd> <kbd>K</kbd> anything · <kbd>d</kbd> theme · <kbd>?</kbd> help
          </span>
        </div>
      </div>
      <p className="legal">
        {day ? `Day ${day}. Keep going.` : "Day one starts when you do."} · ONE v{version}
      </p>
    </footer>
  );
}
