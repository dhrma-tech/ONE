// Tiny synthesized sounds (no audio assets). Respect the `sounds` setting at the call site.
let ctx: AudioContext | null = null;
function tone(freq: number, dur: number, type: OscillatorType = "triangle", gain = 0.08, delay = 0) {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
  } catch { /* audio unavailable */ }
}
export type SoundKind = "move" | "capture" | "check" | "end" | "illegal";
export function play(kind: SoundKind) {
  switch (kind) {
    case "move": tone(520, 0.07, "triangle", 0.07); break;
    case "capture": tone(300, 0.09, "square", 0.05); tone(200, 0.08, "triangle", 0.05, 0.03); break;
    case "check": tone(740, 0.09, "sine", 0.07); tone(980, 0.12, "sine", 0.06, 0.08); break;
    case "end": tone(440, 0.18, "sine", 0.07); tone(554, 0.18, "sine", 0.06, 0.15); tone(659, 0.3, "sine", 0.06, 0.3); break;
    case "illegal": tone(140, 0.12, "sawtooth", 0.03); break;
  }
}
