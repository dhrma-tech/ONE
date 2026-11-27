import { Suspense, type CSSProperties, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AREAS, areaOf } from "@/lib/sections";
import { SCOPE, inScope } from "@/scope";
import { Icon, IconButton, Toaster } from "@/ui";
import { ui, useUI } from "@/data/ui";
import { FocusBar } from "@/modules/focus";
import { CommandPalette, HelpSheet } from "@/modules/palette";
import { MusicCorner } from "@/modules/music";

function NavItem({ a, cls, children }: { a: (typeof AREAS)[number]; cls: string; children: ReactNode }) {
  const loc = useLocation();
  const current = areaOf(loc.pathname) === a.id;
  const style = { "--item-accent": `var(--accent-${a.id})` } as CSSProperties;
  if (!inScope(a.path))
    return (
      <a href={a.path} target="_blank" rel="noreferrer" className={cls} style={style} aria-label={`${a.label} (opens ONE)`}>
        {children}
      </a>
    );
  return (
    <Link to={a.path} className={cls} style={style} aria-current={current ? "page" : undefined} aria-label={a.label}>
      {children}
    </Link>
  );
}

function visibleAreas() {
  if (SCOPE === "master") return AREAS;
  return AREAS.filter((a) => a.id === SCOPE || a.id === "settings");
}

export function Rail() {
  const { theme } = useUI();
  return (
    <aside className="rail" aria-label="Main">
      <Link to={SCOPE === "master" ? "/" : `/${SCOPE}`} className="rail-logo" aria-label="ONE home">
        1
      </Link>
      <nav className="rail-nav">
        {visibleAreas().map((a) => (
          <NavItem key={a.id} a={a} cls="rail-item">
            <Icon name={a.icon} size={20} />
            <span className="rail-tip">
              {a.label} <kbd>g</kbd>
              <kbd>{a.key}</kbd>
            </span>
          </NavItem>
        ))}
      </nav>
      <div className="rail-spacer" />
      <div className="rail-foot">
        <IconButton icon="search" label="Command palette (Ctrl+K)" onClick={() => ui.set({ paletteOpen: true })} />
        <IconButton icon="music" label="Music corner" onClick={() => ui.set({ musicOpen: !ui.get().musicOpen })} />
        <IconButton icon={theme === "dark" ? "sun" : "moon"} label="Toggle theme (d)" onClick={() => ui.toggleTheme()} />
      </div>
    </aside>
  );
}

export function Dock() {
  return (
    <nav className="dock" aria-label="Main">
      {visibleAreas().map((a) => (
        <NavItem key={a.id} a={a} cls="dock-item">
          <Icon name={a.icon} size={20} />
          <span>{a.label}</span>
        </NavItem>
      ))}
    </nav>
  );
}

export function PageFallback() {
  return (
    <div className="stack" aria-busy="true" style={{ padding: 24 }}>
      <span className="micro">Loading…</span>
    </div>
  );
}

/** App layout: rail (desktop/tablet) or dock (phone), full-width content up to 1440px. */
export function Shell({ children }: { children?: ReactNode }) {
  const loc = useLocation();
  const area = areaOf(loc.pathname);
  return (
    <div className="shell" data-section={area}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Rail />
      <main id="main" className="shell-main" tabIndex={-1}>
        <div className="shell-inner page-enter" key={area}>
          <FocusBar />
          <Suspense fallback={<PageFallback />}>{children ?? <Outlet />}</Suspense>
        </div>
      </main>
      <Dock />
      <CommandPalette />
      <HelpSheet />
      <MusicCorner />
      <Toaster />
    </div>
  );
}
