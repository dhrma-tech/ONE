// App-wide command registry: pages register contextual commands (new game, flip...) shown in the palette.
export interface Cmd { id: string; label: string; hint?: string; keys?: string; run: () => void }
let extra: Cmd[] = [];
export const commands = {
  set: (c: Cmd[]) => { extra = c; },
  clear: () => { extra = []; },
  get: () => extra,
};
