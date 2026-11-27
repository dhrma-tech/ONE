// Original pixel-style banner scenes for ONE. Drawn on an 8px grid in an 800x240 viewBox.
// Colours come from theme tokens and section accents, so scenes recolour with the theme.
// Loops use .anim-* classes and only run while the parent Banner has data-anim="on".
import type { CSSProperties, ReactNode } from "react";

const V = (name: string) => `var(--${name})`;
const INK = V("scene-ink");
const DIM = V("scene-dim");
const WOOD = V("scene-wood");
const GLOW = V("scene-glow");
const C = { career: V("accent-career"), mind: V("accent-mind"), body: V("accent-body"), persona: V("accent-persona") };

type S = CSSProperties & Record<`--${string}`, string | number>;

function R({ x, y, w, h, f, o, cls, s }: { x: number; y: number; w: number; h: number; f: string; o?: number; cls?: string; s?: S }) {
  return <rect x={x} y={y} width={w} height={h} fill={f} opacity={o} className={cls} style={s} shapeRendering="crispEdges" />;
}

/** Deterministic star field. */
function Stars({ n = 28, seed = 7, maxY = 120, x0 = 0, x1 = 800 }: { n?: number; seed?: number; maxY?: number; x0?: number; x1?: number }) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const x = Math.round((x0 + rnd() * (x1 - x0)) / 4) * 4;
        const y = Math.round((8 + rnd() * maxY) / 4) * 4;
        const big = rnd() > 0.8;
        return (
          <R
            key={i}
            x={x}
            y={y}
            w={big ? 4 : 2}
            h={big ? 4 : 2}
            f={V("particle")}
            cls="anim-twinkle"
            s={{ "--dur": `${2 + rnd() * 3}s`, animationDelay: `-${rnd() * 4}s` }}
          />
        );
      })}
    </g>
  );
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg className="scene" viewBox="0 0 800 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <rect width="800" height="240" fill={V("scene-sky")} />
      {children}
    </svg>
  );
}

function Floor({ y = 200 }: { y?: number }) {
  return (
    <g>
      <R x={0} y={y} w={800} h={240 - y} f={DIM} o={0.35} />
      <R x={0} y={y} w={800} h={2} f={INK} o={0.25} />
    </g>
  );
}

function Window({ x, y, w = 128, h = 96, children }: { x: number; y: number; w?: number; h?: number; children?: ReactNode }) {
  return (
    <g>
      <R x={x - 4} y={y - 4} w={w + 8} h={h + 8} f={INK} o={0.22} />
      <R x={x} y={y} w={w} h={h} f={V("scene-sky")} />
      {children}
      <R x={x + w / 2 - 1} y={y} w={2} h={h} f={INK} o={0.22} />
      <R x={x} y={y + h / 2 - 1} w={w} h={2} f={INK} o={0.22} />
    </g>
  );
}

function Moon({ x, y }: { x: number; y: number }) {
  return (
    <g className="anim-float" style={{ "--dur": "6s", "--float": "-3px" } as S}>
      <R x={x} y={y + 4} w={20} h={12} f={GLOW} />
      <R x={x + 4} y={y} w={12} h={20} f={GLOW} />
      <R x={x + 8} y={y + 4} w={8} h={8} f={V("scene-sky")} />
    </g>
  );
}

function Monitor({ x, y, w = 152, h = 96, accent, children }: { x: number; y: number; w?: number; h?: number; accent: string; children?: ReactNode }) {
  return (
    <g>
      <R x={x - 6} y={y - 6} w={w + 12} h={h + 12} f={INK} o={0.85} />
      <R x={x} y={y} w={w} h={h} f="#05070a" />
      <R x={x} y={y} w={w} h={h} f={accent} o={0.08} />
      {children}
      <R x={x + w / 2 - 8} y={y + h + 6} w={16} h={14} f={INK} o={0.7} />
      <R x={x + w / 2 - 28} y={y + h + 20} w={56} h={4} f={INK} o={0.7} />
      {/* screen glow onto the desk */}
      <R x={x - 20} y={y + h + 24} w={w + 40} h={6} f={accent} o={0.12} />
    </g>
  );
}

function CodeLines({ x, y, accent, rows = 14, clipId }: { x: number; y: number; accent: string; rows?: number; clipId: string }) {
  const widths = [72, 48, 96, 64, 28, 88, 56, 40, 104, 60, 32, 80, 52, 92, 44, 70];
  return (
    <g clipPath={`url(#${clipId})`}>
      <g className="anim-scroll" style={{ "--dur": "10s", "--scroll": `-${rows * 6}px` } as S}>
        {Array.from({ length: rows * 2 }, (_, i) => {
          const w = widths[i % widths.length];
          const indent = (i % 4 === 1 || i % 4 === 2 ? 12 : 0) + (i % 7 === 3 ? 12 : 0);
          return (
            <g key={i}>
              <R x={x + indent} y={y + i * 12} w={Math.min(w, 120 - indent)} h={4} f={i % 5 === 0 ? accent : INK} o={i % 5 === 0 ? 0.9 : 0.45} />
              {i % 3 === 0 ? <R x={x + indent + w * 0.6} y={y + i * 12} w={16} h={4} f={accent} o={0.6} /> : null}
            </g>
          );
        })}
      </g>
    </g>
  );
}

function Mug({ x, y, accent }: { x: number; y: number; accent: string }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <R key={i} x={x + 4 + i * 8} y={y - 22} w={3} h={14} f={INK} o={0.55} cls="anim-steam" s={{ "--dur": "3.2s", animationDelay: `${i * 0.9}s` }} />
      ))}
      <R x={x} y={y} w={28} h={24} f={accent} />
      <R x={x + 28} y={y + 6} w={8} h={4} f={accent} />
      <R x={x + 32} y={y + 6} w={4} h={12} f={accent} />
      <R x={x + 28} y={y + 14} w={8} h={4} f={accent} />
      <R x={x + 4} y={y + 4} w={20} h={4} f="#000" o={0.25} />
    </g>
  );
}

function Desk({ x, w, y = 176 }: { x: number; w: number; y?: number }) {
  return (
    <g>
      <R x={x} y={y} w={w} h={8} f={WOOD} />
      <R x={x} y={y + 8} w={w} h={2} f="#000" o={0.3} />
      <R x={x + 8} y={y + 10} w={8} h={200 - y - 10 + 30} f={WOOD} o={0.85} />
      <R x={x + w - 16} y={y + 10} w={8} h={200 - y - 10 + 30} f={WOOD} o={0.85} />
    </g>
  );
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon points={`${x - 30},${y + 70} ${x + 46},${y + 70} ${x + 16},${y + 14} ${x},${y + 14}`} fill={GLOW} opacity={0.08} />
      <R x={x} y={y} w={16} h={14} f={INK} o={0.8} />
      <R x={x + 6} y={y + 14} w={4} h={56} f={INK} o={0.7} />
      <R x={x - 4} y={y + 68} w={24} h={4} f={INK} o={0.7} />
      <R x={x + 2} y={y + 12} w={12} h={3} f={GLOW} cls="anim-twinkle" s={{ "--dur": "5s" }} />
    </g>
  );
}

function Chessboard({ x, y, size = 8, n = 8, accent }: { x: number; y: number; size?: number; n?: number; accent: string }) {
  return (
    <g>
      <R x={x - 3} y={y - 3} w={n * size + 6} h={n * size + 6} f={INK} o={0.6} />
      {Array.from({ length: n * n }, (_, i) => {
        const r = Math.floor(i / n);
        const c = i % n;
        return <R key={i} x={x + c * size} y={y + r * size} w={size} h={size} f={(r + c) % 2 ? accent : INK} o={(r + c) % 2 ? 0.55 : 0.12} />;
      })}
    </g>
  );
}

function Knight({ x, y, f }: { x: number; y: number; f: string }) {
  // 12x16 pixel knight
  const px = [
    "....XXXX....",
    "...XXXXXX...",
    "..XXX.XXXX..",
    "..XXXXXXXXX.",
    ".XXXXXXXXXX.",
    ".XXXX..XXXX.",
    "....XXXXXX..",
    "...XXXXXX...",
    "...XXXXXX...",
    "..XXXXXXXX..",
    "..XXXXXXXX..",
    ".XXXXXXXXXX.",
  ];
  return (
    <g>
      {px.flatMap((row, r) =>
        row.split("").map((ch, c) => (ch === "X" ? <R key={`${r}-${c}`} x={x + c * 2} y={y + r * 2} w={2} h={2} f={f} /> : null)),
      )}
    </g>
  );
}

function Dumbbell({ x, y, accent, scale = 1 }: { x: number; y: number; accent: string; scale?: number }) {
  const k = scale;
  return (
    <g>
      <R x={x} y={y} w={8 * k} h={20 * k} f={accent} />
      <R x={x + 8 * k} y={y + 4 * k} w={4 * k} h={12 * k} f={accent} o={0.8} />
      <R x={x + 12 * k} y={y + 8 * k} w={28 * k} h={4 * k} f={INK} o={0.7} />
      <R x={x + 40 * k} y={y + 4 * k} w={4 * k} h={12 * k} f={accent} o={0.8} />
      <R x={x + 44 * k} y={y} w={8 * k} h={20 * k} f={accent} />
    </g>
  );
}

function Mic({ x, y, accent, h = 92 }: { x: number; y: number; accent: string; h?: number }) {
  return (
    <g>
      <R x={x} y={y} w={16} h={24} f={INK} o={0.85} />
      <R x={x + 2} y={y + 2} w={12} h={4} f={accent} />
      <R x={x + 2} y={y + 10} w={12} h={2} f="#000" o={0.35} />
      <R x={x + 2} y={y + 16} w={12} h={2} f="#000" o={0.35} />
      <R x={x + 6} y={y + 24} w={4} h={h} f={INK} o={0.7} />
      <R x={x - 12} y={y + 24 + h} w={40} h={4} f={INK} o={0.7} />
    </g>
  );
}

function Bubble({ x, y, w, accent, delay }: { x: number; y: number; w: number; accent: string; delay: number }) {
  return (
    <g className="anim-pop" style={{ "--dur": "6s", animationDelay: `${delay}s` } as S}>
      <R x={x} y={y} w={w} h={28} f={accent} o={0.9} />
      <R x={x + 8} y={y + 28} w={8} h={6} f={accent} o={0.9} />
      <R x={x + 10} y={y + 10} w={w * 0.5} h={4} f="#000" o={0.35} />
      <R x={x + 10} y={y + 17} w={w * 0.3} h={4} f="#000" o={0.35} />
    </g>
  );
}

function Clock({ cx, cy, r = 24, accent }: { cx: number; cy: number; r?: number; accent: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 3} fill={INK} opacity={0.7} />
      <circle cx={cx} cy={cy} r={r} fill={V("scene-sky")} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <R key={i} x={cx + Math.sin(a) * (r - 5) - 1} y={cy - Math.cos(a) * (r - 5) - 1} w={2} h={2} f={INK} o={0.6} />;
      })}
      {/* 6:30: hour hand between 6 and 7, minute hand at 6 */}
      <line x1={cx} y1={cy} x2={cx + Math.sin((6.5 / 12) * Math.PI * 2) * (r * 0.5)} y2={cy - Math.cos((6.5 / 12) * Math.PI * 2) * (r * 0.5)} stroke={INK} strokeWidth={3} />
      <line x1={cx} y1={cy} x2={cx} y2={cy + r * 0.8} stroke={INK} strokeWidth={2} />
      <g className="anim-tick" style={{ "--dur": "60s", "--origin": `${cx}px ${cy}px` } as S}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - r * 0.85} stroke={accent} strokeWidth={1.5} />
      </g>
      <circle cx={cx} cy={cy} r={2.5} fill={accent} />
    </g>
  );
}

function gearPath(cx: number, cy: number, r: number, teeth: number, depth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 === 0 || i % 4 === 1 ? r + depth : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

function Meditator({ x, y, accent }: { x: number; y: number; accent: string }) {
  return (
    <g>
      <circle cx={x + 24} cy={y + 34} r={46} fill={accent} opacity={0.18} className="anim-breathe" style={{ "--dur": "8s" } as S} />
      <circle cx={x + 24} cy={y + 34} r={30} fill={accent} opacity={0.14} className="anim-breathe" style={{ "--dur": "8s", animationDelay: "-2s" } as S} />
      {/* head */}
      <R x={x + 16} y={y} w={16} h={16} f={INK} o={0.9} />
      {/* body */}
      <R x={x + 12} y={y + 18} w={24} h={24} f={INK} o={0.85} />
      {/* arms resting */}
      <R x={x + 4} y={y + 30} w={8} h={12} f={INK} o={0.8} />
      <R x={x + 36} y={y + 30} w={8} h={12} f={INK} o={0.8} />
      {/* crossed legs */}
      <R x={x - 4} y={y + 42} w={56} h={12} f={INK} o={0.8} />
      <R x={x + 20} y={y + 6} w={8} h={2} f={V("scene-sky")} />
    </g>
  );
}

export function HomeScene() {
  return (
    <Frame label="A small room at night: a desk with a glowing monitor, a chessboard, dumbbells and a microphone.">
      <Stars n={34} maxY={110} />
      <Window x={56} y={40} w={120} h={88}>
        <Moon x={128} y={56} />
      </Window>
      <Floor />
      <Desk x={248} w={320} />
      <defs>
        <clipPath id="home-screen">
          <rect x={312} y={80} width={136} height={76} />
        </clipPath>
      </defs>
      <Monitor x={300} y={72} w={160} h={92} accent={C.career}>
        <CodeLines x={316} y={86} accent={C.career} clipId="home-screen" rows={8} />
        <R x={420} y={146} w={6} h={10} f={C.career} cls="anim-blink" />
      </Monitor>
      <Chessboard x={480} y={150} size={3} n={8} accent={C.mind} />
      <Knight x={489} y={130} f={C.mind} />
      <Mug x={262} y={152} accent={C.body} />
      <Dumbbell x={600} y={204} accent={C.body} scale={0.9} />
      <Mic x={700} y={80} accent={C.persona} h={96} />
      <Lamp x={196} y={106} />
    </Frame>
  );
}

export function CareerScene() {
  return (
    <Frame label="A desk at night with code scrolling on a monitor, steam rising from a cup and a blinking cursor.">
      <Stars n={22} maxY={100} x0={520} x1={800} seed={3} />
      <Window x={600} y={36} w={136} h={96}>
        <Moon x={660} y={52} />
      </Window>
      <Floor />
      <Desk x={140} w={420} />
      <defs>
        <clipPath id="career-screen">
          <rect x={244} y={44} width={208} height={108} />
        </clipPath>
      </defs>
      <Monitor x={232} y={36} w={232} h={124} accent={C.career}>
        <R x={244} y={44} w={8} h={8} f={C.career} o={0.7} />
        <R x={256} y={44} w={8} h={8} f={INK} o={0.3} />
        <R x={268} y={44} w={8} h={8} f={INK} o={0.3} />
        <CodeLines x={248} y={60} accent={C.career} clipId="career-screen" rows={12} />
        <R x={420} y={140} w={8} h={12} f={C.career} cls="anim-blink" />
      </Monitor>
      {/* keyboard */}
      <R x={276} y={166} w={140} h={8} f={INK} o={0.55} />
      {Array.from({ length: 12 }, (_, i) => (
        <R key={i} x={280 + i * 11} y={168} w={8} h={2} f="#000" o={0.35} />
      ))}
      <Mug x={480} y={152} accent={C.career} />
      <Lamp x={160} y={102} />
      {/* stack of books */}
      <R x={500} y={144} w={44} h={8} f={C.mind} o={0.7} />
      <R x={504} y={136} w={40} h={8} f={C.persona} o={0.7} />
    </Frame>
  );
}

export function MindScene() {
  return (
    <Frame label="A chessboard with a knight gliding across it, and a seated figure meditating inside a slowly breathing glow.">
      <Stars n={30} maxY={140} seed={11} />
      <Floor y={208} />
      <Chessboard x={120} y={88} size={14} n={8} accent={C.mind} />
      <g className="anim-glide" style={{ "--dur": "8s", "--gx": "28px", "--gy": "-14px" } as S}>
        <Knight x={176} y={110} f={GLOW} />
      </g>
      <Knight x={232} y={166} f={C.mind} />
      <Meditator x={560} y={128} accent={C.mind} />
      {/* incense smoke */}
      {[0, 1].map((i) => (
        <R key={i} x={672 + i * 6} y={168} w={3} h={16} f={INK} o={0.4} cls="anim-steam" s={{ "--dur": "4s", animationDelay: `${i * 1.6}s` }} />
      ))}
      <R x={668} y={188} w={20} h={6} f={WOOD} />
    </Frame>
  );
}

export function BodyScene() {
  return (
    <Frame label="A barbell with plates, a sunrise through a window and a wall clock reading 6:30.">
      <defs>
        <clipPath id="body-window">
          <rect x={92} y={36} width={176} height={120} />
        </clipPath>
      </defs>
      <Window x={92} y={36} w={176} h={120}>
        <g clipPath="url(#body-window)">
          <R x={92} y={116} w={176} h={40} f={C.body} o={0.18} />
          <g className="anim-sun" style={{ "--dur": "14s" } as S}>
            <circle cx={180} cy={128} r={22} fill={C.body} opacity={0.9} />
            <circle cx={180} cy={128} r={34} fill={C.body} opacity={0.15} />
          </g>
          <R x={92} y={132} w={176} h={24} f={DIM} />
          <R x={120} y={124} w={24} h={8} f={DIM} />
          <R x={196} y={120} w={40} h={12} f={DIM} />
        </g>
      </Window>
      <Clock cx={360} cy={76} r={26} accent={C.body} />
      <Floor />
      {/* rack */}
      <R x={456} y={92} w={8} h={108} f={INK} o={0.6} />
      <R x={664} y={92} w={8} h={108} f={INK} o={0.6} />
      <R x={448} y={112} w={24} h={6} f={INK} o={0.7} />
      <R x={656} y={112} w={24} h={6} f={INK} o={0.7} />
      {/* barbell */}
      <R x={420} y={106} w={288} h={4} f={INK} o={0.85} />
      <R x={436} y={84} w={12} h={48} f={C.body} />
      <R x={424} y={90} w={10} h={36} f={C.body} o={0.75} />
      <R x={680} y={84} w={12} h={48} f={C.body} />
      <R x={694} y={90} w={10} h={36} f={C.body} o={0.75} />
      <Dumbbell x={480} y={180} accent={C.body} scale={0.8} />
      <Dumbbell x={560} y={180} accent={C.body} scale={0.8} />
      {/* water bottle */}
      <R x={744} y={164} w={16} h={36} f={C.persona} o={0.6} />
      <R x={748} y={156} w={8} h={8} f={INK} o={0.6} />
    </Frame>
  );
}

export function PersonaScene() {
  const nodes = [
    [560, 60],
    [640, 40],
    [720, 84],
    [620, 120],
    [700, 160],
  ];
  const links = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 2],
    [3, 4],
    [2, 4],
  ];
  return (
    <Frame label="A stage microphone, speech bubbles popping in sequence, and dotted lines connecting people.">
      <Stars n={16} maxY={80} x0={0} x1={420} seed={5} />
      <Floor y={204} />
      {/* spotlight */}
      <polygon points="260,0 300,0 360,204 200,204" fill={GLOW} opacity={0.07} />
      <R x={200} y={200} w={160} h={6} f={GLOW} o={0.12} />
      <Mic x={272} y={88} accent={C.persona} h={88} />
      <Bubble x={96} y={60} w={96} accent={C.persona} delay={0} />
      <Bubble x={324} y={40} w={80} accent={C.persona} delay={2} />
      <Bubble x={150} y={124} w={64} accent={C.persona} delay={4} />
      <g>
        {links.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke={C.persona}
            strokeOpacity={0.6}
            strokeWidth={2}
            strokeDasharray="4 4"
            className="anim-dash"
            style={{ "--dur": `${1 + (i % 3) * 0.4}s` } as S}
          />
        ))}
        {nodes.map(([x, y], i) => (
          <g key={i}>
            <R x={x - 8} y={y - 8} w={16} h={16} f={i === 0 ? C.persona : INK} o={i === 0 ? 1 : 0.8} />
            <R x={x - 4} y={y - 4} w={8} h={4} f={V("scene-sky")} o={0.7} />
          </g>
        ))}
      </g>
    </Frame>
  );
}

export function SettingsScene() {
  return (
    <Frame label="Two interlocking gears turning slowly.">
      <Stars n={18} maxY={200} seed={19} />
      <g className="anim-tick" style={{ "--dur": "24s", "--origin": "340px 120px" } as S}>
        <path d={gearPath(340, 120, 64, 12, 12)} fill={INK} opacity={0.22} />
        <circle cx={340} cy={120} r={22} fill={V("scene-sky")} />
        <circle cx={340} cy={120} r={8} fill={V("accent-settings")} />
      </g>
      <g className="anim-tick" style={{ "--dur": "16s", "--origin": "462px 150px", animationDirection: "reverse" } as S}>
        <path d={gearPath(462, 150, 40, 8, 10)} fill={INK} opacity={0.3} />
        <circle cx={462} cy={150} r={14} fill={V("scene-sky")} />
      </g>
      <Floor y={220} />
    </Frame>
  );
}

export const SCENES = {
  home: HomeScene,
  career: CareerScene,
  mind: MindScene,
  body: BodyScene,
  persona: PersonaScene,
  settings: SettingsScene,
} as const;
