import React from "react";
import { C, F, H, W } from "./theme";
import { p, useCurrentFrame } from "./time";
import { Screenshot, type View } from "./shot";

/** Full-bleed footage: a Screenshot that fills the frame, with a soft band at the bottom so a Caption stays legible over it. */
export const Wide: React.FC<{ src: string; iw: number; ih: number; at?: number; out?: number; video?: boolean; view?: View[]; band?: number; dim?: number; children?: React.ReactNode }> = ({
  src,
  iw,
  ih,
  at = 0,
  out = Infinity,
  video,
  view,
  band = 0.7,
  dim = 0,
  children,
}) => (
  <g>
    <Screenshot src={src} iw={iw} ih={ih} x={0} y={0} w={W} h={H} at={at} out={out} video={video} view={view} radius={0}>
      {children}
    </Screenshot>
    <defs>
      <linearGradient id="wide-band" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={C.bg} stopOpacity={0} />
        <stop offset="100%" stopColor={C.bg} stopOpacity={band} />
      </linearGradient>
    </defs>
    <rect x={0} y={H - 300} width={W} height={300} fill="url(#wide-band)" />
    {dim > 0 && <rect width={W} height={H} fill={C.bg} opacity={dim} />}
  </g>
);

export type Person = { name: string; color: string; c: [number, number]; k?: [number, number, number] };
const WANDER: [number, number, number][] = [[0.13, 0.31, 0], [0.17, 0.11, 1.7], [0.09, 0.23, 3.1], [0.15, 0.19, 4.4]];

/** Players wandering over a Screenshot, in image pixels: `down` greys them (the world crashed), `names` fades name tags in, `size` is the dot radius. */
export const People: React.FC<{ people: Person[]; down?: number; names?: number; size?: number; freeze?: number }> = ({ people, down = 0, names = 0, size = 22, freeze }) => {
  const frame = useCurrentFrame();
  const t = (freeze != null && frame > freeze ? freeze : frame) / 60;
  return (
    <g>
      {people.map((pl, i) => {
        const k = pl.k ?? WANDER[i % WANDER.length];
        const x = pl.c[0] + size * 4 * Math.sin(t * k[0] * 6.28 + k[2]);
        const y = pl.c[1] + size * 2.3 * Math.sin(t * k[1] * 6.28 + k[2] * 1.3) + down * size * 1.4;
        return (
          <g key={pl.name} transform={`translate(${x} ${y})`} opacity={1 - down * 0.6}>
            <circle r={size * 2} fill={pl.color} opacity={0.25 * (1 - down)} />
            <circle r={size} fill={down > 0.5 ? C.dim : pl.color} stroke={C.bg} strokeWidth={size * 0.28} />
            {names > 0 && (
              <text y={-size * 2.3} textAnchor="middle" fontFamily={F.sans} fontWeight={700} fontSize={size * 4.5} fill={C.paper} opacity={names} stroke={C.bg} strokeWidth={size * 0.6} style={{ paintOrder: "stroke" }} data-role="label">
                {pl.name}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
};

/** A scrolling heartbeat trace; after `freeze` it flatlines. `at` fades it in. */
export const Pulse: React.FC<{ x: number; y: number; w: number; h?: number; at: number; freeze?: number; period?: number; color?: string }> = ({ x, y, w, h = 90, at, freeze = Infinity, period = 40, color = C.ok }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 30);
  if (a <= 0) return null;
  const n = 120;
  const beat = (u: number) => {
    const s = u % 1;
    if (s < 0.08) return -s * 3;
    if (s < 0.16) return 1.1 - (s - 0.08) * 26;
    if (s < 0.22) return -1.0 + (s - 0.16) * 16;
    return 0;
  };
  let d = "";
  for (let i = 0; i <= n; i++) {
    const px = x + (w * i) / n;
    const tf = frame - (n - i) * 1.5;
    const v = tf > freeze ? 0 : beat(tf / period);
    d += `${i ? " L" : "M"} ${px.toFixed(1)} ${(y - v * h * 0.5).toFixed(1)}`;
  }
  const flat = frame > freeze ? Math.min(1, (frame - freeze) / (n * 1.5)) : 0;
  const c = flat > 0.6 ? C.bad : color;
  return (
    <g opacity={a}>
      <line x1={x} x2={x + w} y1={y} y2={y} stroke={C.line} strokeWidth={1.5} />
      <path d={d} stroke={c} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" filter="url(#glow)" />
      <circle cx={x + w} cy={y - (frame > freeze ? 0 : beat(frame / period)) * h * 0.5} r={7} fill={c} />
    </g>
  );
};
