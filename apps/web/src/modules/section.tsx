import { Suspense, type ReactNode } from "react";
import { Banner, Chip, Icon, RouteTabs, type TabDef } from "@/ui";
import { useSummary } from "@/services/summary";
import type { SectionId } from "@/lib/sections";

const N: Record<SectionId, string> = { career: "01", mind: "02", body: "03", persona: "04" };
const LABEL: Record<SectionId, string> = { career: "Career", mind: "Mind", body: "Body", persona: "Persona" };

/** Section page frame: banner, numbered title, level/streak chips, route tabs. */
export function SectionLayout({
  section,
  tabs,
  children,
  right,
}: {
  section: SectionId;
  tabs: TabDef[];
  children: ReactNode;
  right?: ReactNode;
}) {
  const sum = useSummary();
  const st = sum?.sectionStreaks[section];
  const lv = sum?.xp.bySection[section];
  const today = sum?.todaySections[section];
  return (
    <div className="page" data-section={section}>
      <div className="section-hero">
        <Banner scene={section} />
        <div className="section-title-row">
          <h1>
            <span className="n">{N[section]}</span>
            {LABEL[section]}
            <span className="accent">.</span>
          </h1>
          <div className="row wrap">
            <Chip tone={today?.done ? "ok" : undefined} dot>
              {today ? (today.done ? "Done today" : `${Math.round(today.progress * 100)}% today`) : "…% today"}
            </Chip>
            <Chip>
              <Icon name="flame" size={11} /> {st?.current ?? 0} day streak
            </Chip>
            <Chip>Lv {lv?.level ?? 1}</Chip>
            {right}
          </div>
        </div>
      </div>
      <RouteTabs base={`/${section}`} tabs={tabs} label={`${LABEL[section]} sections`} />
      {/* Local boundary: lazy tabs suspend here, so the banner and tabs never unmount (no layout shift). */}
      <Suspense fallback={<div className="tab-fallback" aria-busy="true" />}>{children}</Suspense>
    </div>
  );
}
