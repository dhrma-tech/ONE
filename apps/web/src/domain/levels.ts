/** XP needed to go from level n to n+1: round(100 * n^1.5). */
export const xpForLevel = (n: number): number => Math.round(100 * Math.pow(n, 1.5));

/** Level info from total XP. Level starts at 1. */
export function levelFromXp(total: number): { level: number; into: number; need: number; pct: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(total));
  while (rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return { level, into: rest, need, pct: need ? rest / need : 0 };
}
