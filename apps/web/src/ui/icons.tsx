// Original stroke icons for ONE (24px grid, 1.6 stroke). Decorative by default; pass `title` to label.
import type { SVGProps } from "react";

export type IconName =
  | "home" | "career" | "mind" | "body" | "persona" | "settings" | "search" | "arrow" | "arrowLeft" | "check" | "plus"
  | "x" | "play" | "stop" | "pause" | "music" | "sun" | "moon" | "chevron" | "chevronDown" | "star" | "flame" | "clock"
  | "calendar" | "trash" | "edit" | "up" | "down" | "link" | "external" | "lock" | "mic" | "camera" | "note" | "book"
  | "grid" | "chart" | "trophy" | "focus" | "drop" | "scale" | "bolt" | "chess" | "inbox" | "list" | "copy" | "refresh"
  | "download" | "upload" | "eye" | "menu" | "dots" | "send" | "user" | "code" | "news" | "flag" | "heart" | "leaf";

const P: Record<IconName, string> = {
  home: "M4 11 12 4l8 7M6 9.5V20h4.5v-5h3v5H18V9.5",
  career: "M4 8h16v11H4zM9 8V5.5h6V8M4 13h16M11 13v2h2v-2",
  mind: "M9 4.5a3.5 3.5 0 0 0-3.4 4.3A3.5 3.5 0 0 0 6 15.5 3.5 3.5 0 0 0 12 18V5.6A3.4 3.4 0 0 0 9 4.5ZM15 4.5a3.5 3.5 0 0 1 3.4 4.3 3.5 3.5 0 0 1-.4 6.7A3.5 3.5 0 0 1 12 18",
  body: "M3 10v4M6 8v8M6 12h12M18 8v8M21 10v4",
  persona: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  search: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM15.5 15.5 20 20",
  arrow: "M4 12h15M14 7l5 5-5 5",
  arrowLeft: "M20 12H5M10 7l-5 5 5 5",
  check: "M5 12.5 10 17 19 7",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  play: "M8 5.5v13l10.5-6.5z",
  stop: "M6.5 6.5h11v11h-11z",
  pause: "M8 5.5v13M16 5.5v13",
  music: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  chevron: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z",
  flame: "M12 21c-3.9 0-7-2.8-7-6.6 0-3 2-5 3.5-6.6.3 1.6 1.2 2.6 2.4 3C10 7.5 12 5 14 3c.3 3 2.5 4.3 3.7 6.4.8 1.3 1.3 2.8 1.3 4.6 0 4-3.1 7-7 7Z",
  clock: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2",
  calendar: "M4 6h16v14H4zM4 10h16M8 3.5V7M16 3.5V7",
  trash: "M5 7h14M9 7V4.5h6V7M7 7l1 13h8l1-13",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM6 11a6 6 0 0 0 12 0M12 17v4",
  camera: "M4 7.5h3.5L9 5h6l1.5 2.5H20V19H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
  note: "M6 3.5h9l4 4V20.5H6zM14.5 3.5V8H19M9 12h7M9 15.5h7",
  book: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 20.5h8",
  focus: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  drop: "M12 3.5s6 6.6 6 10.5a6 6 0 0 1-12 0c0-3.9 6-10.5 6-10.5Z",
  scale: "M5 4h14v16H5zM9 9a4.5 4.5 0 0 1 6 0M12 9l1.2-1.5",
  bolt: "M13 3 5 13.5h6L10 21l8-10.5h-6z",
  chess: "M9 20.5h6M8 18h8l-1-4h-6zM10 14l-.5-5h5L14 14M9 9l-1-4 2.5 1L12 4l1.5 2L16 5l-1 4",
  inbox: "M4 13.5 6.5 5h11l2.5 8.5V19H4zM4 13.5h5l1 2h4l1-2h5",
  list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 15V4M7 9l5-5 5 5M5 20h14",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  dots: "M6 12h.01M12 12h.01M18 12h.01",
  send: "M4 12 20 4l-6 16-3-7z",
  user: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  code: "M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15",
  news: "M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7.5 8.5h6M7.5 12h6M7.5 15.5h4",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  heart: "M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10C19.5 15.6 12 20 12 20Z",
  leaf: "M5 19C5 10 11 5 20 4c0 9-5 15-14 15M5 19l7-7",
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
  title?: string;
}

export function Icon({ name, size = 18, title, ...rest }: IconProps) {
  const fillOnly = name === "play" || name === "star";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fillOnly ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={fillOnly ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={P[name]} />
    </svg>
  );
}
