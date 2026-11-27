import type { IconName } from "@/ui/icons";

export type SectionId = "career" | "mind" | "body" | "persona";
export type Area = SectionId | "home" | "settings";

export interface SectionMeta {
  id: Area;
  n: number;
  label: string;
  path: string;
  icon: IconName;
  key: string; // g <key> shortcut
}

export const SECTIONS: SectionId[] = ["career", "mind", "body", "persona"];

export const AREAS: SectionMeta[] = [
  { id: "home", n: 0, label: "Home", path: "/", icon: "home", key: "h" },
  { id: "career", n: 1, label: "Career", path: "/career", icon: "career", key: "c" },
  { id: "mind", n: 2, label: "Mind", path: "/mind", icon: "mind", key: "m" },
  { id: "body", n: 3, label: "Body", path: "/body", icon: "body", key: "b" },
  { id: "persona", n: 4, label: "Persona", path: "/persona", icon: "persona", key: "p" },
  { id: "settings", n: 5, label: "Settings", path: "/settings", icon: "settings", key: "s" },
];

export const areaOf = (pathname: string): Area => {
  const seg = pathname.split("/")[1] ?? "";
  return (["career", "mind", "body", "persona", "settings"].includes(seg) ? seg : "home") as Area;
};

export const sectionLabel = (s: Area): string => AREAS.find((a) => a.id === s)?.label ?? s;
