import { useEffect, useState } from "react";
export const go = (hash: string) => { location.hash = hash; };
function parse() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [p, qs = ""] = h.split("?");
  return { path: p.split("/").filter(Boolean), q: new URLSearchParams(qs) };
}
export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => { setR(parse()); window.scrollTo(0, 0); };
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  return r;
}
