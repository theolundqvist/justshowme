import React from "react";
import { SvgImage } from "./shot";
import { noise2D } from "@remotion/noise";
import { C, E, F, T } from "./theme";
import { hash, p, useCurrentFrame } from "./time";

export type Player = { name: string; color: string; seed: number };
export const PLAYERS: Player[] = [
  { name: "ada", color: C.live, seed: 1 },
  { name: "mo", color: C.cool, seed: 2 },
  { name: "kai", color: C.violet, seed: 3 },
];

/** World map local size; draw `children` in this space (0,0 top-left, 720×440). */
export const WW = 720, WH = 440;
const TILE = 40;
const TAU = Math.PI * 2;
const lakeAt = (x: number, y: number) => Math.hypot((x - 170) / 120, (y - 300) / 80) < 1.15;
const TREES = Array.from({ length: 70 }, (_, i) => [20 + hash(i * 3.3) * (WW - 40), 20 + hash(i * 7.7) * (WH - 40), 9 + hash(i * 1.9) * 8])
  .filter(([x, y]) => !lakeAt(x, y) && !(x > 440 && x < 610 && y > 250 && y < 380))
  .sort((a, b) => a[1] - b[1]);
const blob = (cx: number, cy: number, rx: number, ry: number, f: (a: number) => number, n = 48) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * TAU, r = f(a);
    return `${i ? "L" : "M"} ${(cx + Math.cos(a) * rx * r).toFixed(1)} ${(cy + Math.sin(a) * ry * r).toFixed(1)}`;
  }).join(" ") + " Z";
const LAKE = blob(170, 300, 120, 80, (a) => 1 + 0.1 * Math.sin(a * 3) + 0.06 * Math.cos(a * 5), 64);
export const LAVA = [520, 310] as const;
export const playerPos = (pl: Player, frame: number, fps = 60) => {
  const t = frame / fps, c = [[360, 180], [480, 330], [240, 130]][(pl.seed - 1) % 3], k = [[0.13, 0.31, 0], [0.17, 0.11, 1.7], [0.09, 0.23, 3.1]][(pl.seed - 1) % 3];
  return [c[0] + 70 * Math.sin(t * k[0] * TAU + k[2]), c[1] + 50 * Math.sin(t * k[1] * TAU + k[2] * 1.3)];
};

const Terrain = React.memo(() => (
  <g>
    {Array.from({ length: (WW / TILE) * (WH / TILE) }, (_, i) => {
      const q = i % (WW / TILE), r = Math.floor(i / (WW / TILE));
      const h = hash(q * 17.3 + r * 91.7);
      return <rect key={i} x={q * TILE} y={r * TILE} width={TILE} height={TILE} fill={`rgb(${38 + h * 10},${70 + h * 16},${52 + h * 8})`} stroke="rgba(0,0,0,.12)" />;
    })}
    <path d={LAKE} fill="#2C5A86" stroke="#5B87B5" strokeWidth={3} />
    <path d="M 300 440 C 330 300 420 240 520 200 C 600 170 640 90 700 40" stroke="rgba(214,196,150,.35)" strokeWidth={14} strokeLinecap="round" fill="none" />
    {TREES.map(([x, y, r], i) => (
      <g key={i}>
        <ellipse cx={x + 3} cy={y + 5} rx={r} ry={r * 0.8} fill="rgba(0,0,0,.25)" />
        <circle cx={x} cy={y} r={r} fill="#23402F" />
        <circle cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.6} fill="#3F6B4E" />
      </g>
    ))}
  </g>
));

/** The lava pool from the running example; `k` grows it in, `bad` tints it towards failure. */
export const LavaPool: React.FC<{ k: number; bad?: number }> = ({ k, bad = 0 }) => {
  const frame = useCurrentFrame();
  if (k <= 0) return null;
  const t = frame / 60;
  return (
    <g transform={`translate(${LAVA[0]} ${LAVA[1]}) scale(${E.snap(k)})`}>
      <circle r={120} fill={`url(#glow-${bad > 0.5 ? "bad" : "lava"})`} />
      <path d={blob(0, 0, 64 * 1.2, 64 * 0.85, (a) => 1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5), 40)} fill="#5A2A1C" />
      <path d={blob(0, 0, 52 * 1.2, 52 * 0.85, (a) => 1 + 0.11 * Math.sin(a * 3 + t * 1.5) + 0.08 * Math.sin(a * 5 - t), 40)} fill={bad > 0.5 ? C.bad : "#F07A3A"} />
      <ellipse rx={30} ry={18} fill="#FFD27A" opacity={0.7} />
      {Array.from({ length: 6 }, (_, i) => {
        const ph = (t * 0.6 + hash(i)) % 1;
        return <circle key={i} cx={(hash(i * 3) - 0.5) * 90} cy={(hash(i * 5) - 0.5) * 50} r={3 + ph * 9} fill="none" stroke="#FFE3A3" strokeWidth={2} opacity={0.8 * (1 - ph)} />;
      })}
    </g>
  );
};

/**
 * The recurring anchor: a top-down game world, centred at (x, y) and scaled by `s`.
 * `image` swaps the illustrated terrain for a real screenshot (players are then off by default).
 * `crack` desaturates and cracks it; `freeze` stops the players at that frame; `ghost` draws a dashed sandbox copy.
 */
export const WorldMap: React.FC<{
  x: number;
  y: number;
  s?: number;
  at?: number;
  image?: string;
  lava?: number;
  bad?: number;
  crack?: number;
  freeze?: number;
  ghost?: boolean;
  dim?: number;
  players?: Player[];
  heartbeat?: boolean;
  label?: string;
  children?: React.ReactNode;
}> = ({ x, y, s = 1, at = 0, image, lava = 0, bad = 0, crack = 0, freeze, ghost, dim = 0, players, heartbeat, label, children }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 40);
  if (a <= 0) return null;
  const pf = freeze != null && frame > freeze ? freeze : frame;
  const ps = players ?? (image ? [] : PLAYERS);
  const id = `wm-${Math.round(x)}-${Math.round(y)}-${ghost ? "g" : "l"}`;
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 20}) scale(${s}) translate(${-WW / 2} ${-WH / 2})`}>
      {!ghost && <rect x={-10} y={8} width={WW + 20} height={WH + 20} rx={26} fill="#000" opacity={0.45} />}
      <clipPath id={id}>
        <rect width={WW} height={WH} rx={18} />
      </clipPath>
      <g clipPath={`url(#${id})`} filter={crack > 0.3 ? "url(#grey)" : undefined} opacity={ghost ? 0.55 : 1}>
        {image ? <SvgImage href={image} width={WW} height={WH} /> : <Terrain />}
        <LavaPool k={lava} bad={bad} />
        {children}
        {ps.map((pl) => {
          const [px, py] = playerPos(pl, pf);
          return (
            <g key={pl.name} transform={`translate(${px} ${py})`}>
              <ellipse cx={2} cy={5} rx={11} ry={7} fill="rgba(0,0,0,.35)" />
              <circle r={10} fill={pl.color} stroke={C.bg} strokeWidth={3} />
            </g>
          );
        })}
        {dim > 0 && <rect width={WW} height={WH} fill={C.bg} opacity={dim} />}
        {crack > 0 && <rect width={WW} height={WH} fill={C.bg} opacity={0.35 * crack} />}
      </g>
      {crack > 0 && <Cracks x={WW * 0.55} y={WH * 0.55} R={420} k={crack} seed={3} color={C.paper} />}
      <rect width={WW} height={WH} rx={18} fill="none" stroke={ghost ? C.cool : C.line} strokeWidth={ghost ? 3 : 2} strokeDasharray={ghost ? "14 10" : undefined} />
      {heartbeat && (() => {
        const ph = (pf / 3) % 1;
        return <circle cx={WW - 26} cy={26} r={7 + 4 * Math.exp(-ph * 6)} fill={freeze != null && frame > freeze ? C.bad : C.ok} />;
      })()}
      {label && (
        <text x={0} y={-24} fontFamily={F.sans} fontWeight={600} fontSize={T.label / s} letterSpacing={2.4 / s} fill={ghost ? C.cool : C.mute} data-role="label">
          {label.toUpperCase()}
        </text>
      )}
    </g>
  );
};

/** Radiating crack lines from (x, y), `k` 0→1 draws them out. Nine seeded arms, like shattered glass. */
export const Cracks: React.FC<{ x: number; y: number; R?: number; k: number; seed?: number; color?: string }> = ({ x, y, R = 300, k, seed = 1, color = C.paper }) => {
  if (k <= 0) return null;
  const e = E.settle(Math.min(1, k));
  return (
    <g strokeLinecap="round" fill="none" opacity={0.9}>
      {Array.from({ length: 9 }, (_, i) => {
        let ang = hash(seed * 31 + i) * TAU, px = x, py = y;
        const len = R * (0.5 + hash(seed * 7 + i) * 0.6) * e;
        let d = `M ${px} ${py}`;
        for (let s = 1; s <= 7; s++) {
          ang += (hash(seed * 13 + i * 17 + s) - 0.5) * 0.9;
          px += (Math.cos(ang) * len) / 7;
          py += (Math.sin(ang) * len) / 7;
          d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        return <path key={i} d={d} stroke={color} strokeWidth={3.2 - i * 0.2} />;
      })}
    </g>
  );
};

/** A browser window; children draw in the content area (0,0 = content top-left). */
export const Browser: React.FC<{ x: number; y: number; w: number; h: number; at: number; title?: string; color?: string; alive?: number; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  at,
  title,
  color = C.line,
  alive = 1,
  children,
}) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 36);
  if (a <= 0) return null;
  const bar = 54;
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 16})`}>
      <rect x={4} y={14} width={w} height={h} rx={16} fill="#000" opacity={0.32} />
      <rect width={w} height={h} rx={16} fill={C.panel} stroke={color} strokeWidth={2} />
      <line x1={0} x2={w} y1={bar} y2={bar} stroke={C.line} />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={26 + i * 22} cy={bar / 2} r={7} fill={C.line} />
      ))}
      {title && (
        <text x={w - 22} y={bar / 2 + 11} textAnchor="end" fontFamily={F.mono} fontSize={T.small} fill={C.mute}>
          {title}
        </text>
      )}
      <circle cx={w - 22 - (title ? title.length * T.small * 0.6 + 20 : 0)} cy={bar / 2} r={7} fill={alive > 0.5 ? C.ok : C.bad} />
      <clipPath id={`br-${x}-${y}`}>
        <rect y={bar} width={w} height={h - bar} rx={4} />
      </clipPath>
      <g clipPath={`url(#br-${x}-${y})`}>
        <g transform={`translate(0 ${bar})`}>{children}</g>
      </g>
    </g>
  );
};

/** A Claude session window with its owner and code lines streaming. */
export const Terminal: React.FC<{ x: number; y: number; w?: number; h?: number; at: number; owner: string; seed?: number; out?: number; active?: number }> = ({
  x,
  y,
  w = 400,
  h = 230,
  at,
  owner,
  seed = 0,
  out = Infinity,
  active = 1,
}) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 36) * (1 - p(frame, out, 30));
  if (a <= 0) return null;
  const scroll = (frame - at) / 14;
  const head = 62;
  return (
    <g opacity={a * (0.35 + 0.65 * active)} transform={`translate(${x} ${y + (1 - a) * 16})`}>
      <rect x={4} y={14} width={w} height={h} rx={16} fill="#000" opacity={0.32} />
      <rect width={w} height={h} rx={16} fill="#0E141F" stroke={active > 0.5 ? C.claude : C.line} strokeOpacity={0.5 + 0.5 * active} strokeWidth={2} />
      <path d="M 20 40 l 8 -16 l 8 16 M 14 32 h 28" stroke={C.claude} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <text x={56} y={42} fontFamily={F.sans} fontWeight={600} fontSize={T.small} fill={C.paper}>
        {owner}'s Claude
      </text>
      <line x1={0} x2={w} y1={head} y2={head} stroke={C.line} />
      <clipPath id={`term-${owner}-${seed}`}>
        <rect x={0} y={head + 4} width={w} height={h - head - 8} />
      </clipPath>
      <g clipPath={`url(#term-${owner}-${seed})`}>
        {Array.from({ length: 7 }, (_, r) => {
          const k = Math.floor(scroll) + r;
          const len = 0.3 + 0.6 * ((noise2D("tl", k * 0.7, seed) + 1) / 2);
          const indent = (Math.abs(Math.floor(noise2D("ti", k, seed) * 3)) % 3) * 22;
          const yy = head + 24 + (r - (scroll % 1)) * 30;
          const c = [C.violet, C.cool, C.paper, C.ok][Math.abs(k * 7 + seed) % 4];
          return <rect key={k} x={24 + indent} y={yy} width={(w - 80 - indent) * len} height={10} rx={5} fill={c} opacity={0.55} />;
        })}
      </g>
    </g>
  );
};

/** A checkpoint tube: idle → active (bars rise through it) → pass/fail glow. */
export const Gate: React.FC<{ x: number; y: number; at: number; active: number; done: number; label: string; sub?: string; ok?: boolean; h?: number; w?: number; size?: number }> = ({
  x,
  y,
  at,
  active,
  done,
  label,
  sub,
  ok = true,
  h = 240,
  w = 56,
  size = T.label,
}) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 36);
  if (a <= 0) return null;
  const on = p(frame, active, 20);
  const fin = p(frame, done, 24);
  const c = fin > 0 ? (ok ? C.ok : C.bad) : on > 0 ? C.live : C.line;
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 20})`}>
      {on > 0 && <rect x={-w / 2 - 12} y={-h / 2 - 12} width={w + 24} height={h + 24} rx={24} fill="none" stroke={fin > 0 ? c : C.live} strokeWidth={14} opacity={0.22 * Math.max(on * (1 - fin), fin)} />}
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w / 3} fill={C.panel} stroke={c} strokeWidth={2.5} />
      {on > 0 &&
        fin < 1 &&
        [0, 1, 2, 3, 4].map((i) => {
          const t = ((frame - active) / 40 + i / 5) % 1;
          return <rect key={i} x={-w / 2 + 8} y={h / 2 - 18 - t * (h - 24)} width={w - 16} height={10} rx={5} fill={C.live} opacity={Math.sin(t * Math.PI) * 0.8 * on * (1 - fin)} />;
        })}
      {fin > 0 && <rect x={-w / 2 + 8} y={-h / 2 + 8} width={w - 16} height={(h - 16) * fin} rx={w / 3 - 6} fill={c} opacity={0.25} transform={`translate(0 ${(h - 16) * (1 - fin)})`} />}
      <text y={h / 2 + size * 1.4} textAnchor="middle" fontFamily={F.sans} fontWeight={600} fontSize={size} fill={on > 0 ? C.paper : C.mute} data-role="label">
        {label}
      </text>
      {sub && (
        <text y={h / 2 + size * 2.45} textAnchor="middle" fontFamily={F.mono} fontSize={size * 0.68} fill={C.mute} opacity={0.5 + 0.5 * on}>
          {sub}
        </text>
      )}
    </g>
  );
};

/** A module chip: a mod, a file, a bundle. */
export const Chip: React.FC<{ x: number; y: number; text: string; at: number; out?: number; color?: string; size?: number }> = ({ x, y, text, at, out = Infinity, color = C.claude, size = T.small }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 30) * (1 - p(frame, out, 20));
  if (a <= 0) return null;
  const hgt = size * 1.9;
  const width = text.length * size * 0.6 + size * 2.6;
  return (
    <g opacity={a} transform={`translate(${x} ${y}) scale(${0.9 + 0.1 * a})`}>
      <rect x={-width / 2} y={-hgt / 2} width={width} height={hgt} rx={hgt / 2} fill={C.panelHi} stroke={color} strokeWidth={2} />
      <circle cx={-width / 2 + size * 0.95} cy={0} r={size * 0.26} fill={color} />
      <text x={-width / 2 + size * 1.6} y={size * 0.34} fontFamily={F.mono} fontSize={size} fill={C.paper}>
        {text}
      </text>
    </g>
  );
};

type CellStyle = { fill?: string; opacity?: number; ring?: string; r?: number };
/** A grid of entity dots; `style(i)` styles each; `scan` (frame) sweeps a band across that lights cells it passes. */
export const EntityGrid: React.FC<{ x: number; y: number; cols: number; rows: number; cell: number; at: number; scan?: number; scanDur?: number; style?: (i: number, scanned: boolean) => CellStyle }> = ({
  x,
  y,
  cols,
  rows,
  cell,
  at,
  scan = Infinity,
  scanDur = 60,
  style = () => ({}),
}) => {
  const frame = useCurrentFrame();
  const sx = p(frame, scan, scanDur, E.linear) * (cols + 2) - 1;
  const scanning = frame >= scan && frame <= scan + scanDur;
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: cols * rows }, (_, i) => {
        const q = i % cols, r = Math.floor(i / cols);
        const a = p(frame, at + q + r * 2, 24);
        if (a <= 0) return null;
        const s = style(i, frame >= scan && q < sx);
        return (
          <g key={i}>
            {s.ring && <circle cx={(q + 0.5) * cell} cy={(r + 0.5) * cell} r={cell * 0.38} fill="none" stroke={s.ring} strokeWidth={2.5} />}
            <circle cx={(q + 0.5) * cell} cy={(r + 0.5) * cell} r={(s.r ?? cell * 0.2) * a} fill={s.fill ?? "#3A4A6B"} opacity={(s.opacity ?? 1) * a} />
          </g>
        );
      })}
      {scanning && <rect x={sx * cell - cell * 0.6} y={-cell * 0.3} width={cell * 1.2} height={rows * cell + cell * 0.6} rx={cell * 0.3} fill={C.cool} opacity={0.18} />}
    </g>
  );
};
