// Runs before React to avoid a theme flash. Dark (pure black) is the default.
try {
  const t = localStorage.getItem("one.theme");
  document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  const m = localStorage.getItem("one.motion");
  const reduce = m === "reduced" || (m !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  document.documentElement.dataset.motion = reduce ? "reduced" : "full";
} catch {
  document.documentElement.dataset.theme = "dark";
}
export {};
