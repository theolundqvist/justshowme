import React, { useMemo } from "react";
import { getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import { C, E, F, T } from "./theme";
import { p, useCurrentFrame } from "./time";

/** A card-shaped node that settles into place. Children draw in its local space (0,0 = top-left). */
export const Node: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  out?: number;
  label?: string;
  sub?: string;
  color?: string;
  fill?: string;
  glow?: number;
  r?: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, at, out = Infinity, label, sub, color = C.line, fill = C.panel, glow = 0, r = 18, children }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 36);
  const o = 1 - p(frame, out, 24);
  if (a <= 0 || o <= 0) return null;
  const s = 0.94 + 0.06 * a;
  return (
    <g opacity={a * o} transform={`translate(${x + w / 2} ${y + h / 2 + (1 - a) * 18}) scale(${s}) translate(${-w / 2} ${-h / 2})`}>
      {glow > 0 && <rect x={-6} y={-6} width={w + 12} height={h + 12} rx={r + 6} fill="none" stroke={color} strokeWidth={12} opacity={0.3 * glow} />}
      <rect x={4} y={14} width={w} height={h} rx={r} fill="#000" opacity={0.32} />
      <rect width={w} height={h} rx={r} fill={fill} stroke={color} strokeWidth={glow > 0 ? 2 : 1.5} />
      {label && (
        <text x={w / 2} y={sub ? h / 2 - 4 : h / 2 + 12} textAnchor="middle" fontFamily={F.sans} fontWeight={600} fontSize={T.body} fill={C.paper}>
          {label}
        </text>
      )}
      {sub && (
        <text x={w / 2} y={h / 2 + 38} textAnchor="middle" fontFamily={F.mono} fontSize={T.small} fill={C.mute}>
          {sub}
        </text>
      )}
      {children}
    </g>
  );
};

/** An edge that draws on from start to end, optionally with an arrowhead that rides the tip. */
export const Edge: React.FC<{ d: string; at: number; dur?: number; out?: number; color?: string; width?: number; dash?: string; arrow?: boolean; opacity?: number }> = ({
  d,
  at,
  dur = 40,
  out = Infinity,
  color = C.line,
  width = 2.5,
  dash,
  arrow,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const len = useMemo(() => getLength(d), [d]);
  const t = p(frame, at, dur, E.glide);
  const o = 1 - p(frame, out, 24);
  if (t <= 0 || o <= 0) return null;
  const tip = getPointAtLength(d, len * t)!;
  const tan = getTangentAtLength(d, len * t)!;
  const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  return (
    <g opacity={o * opacity}>
      {dash ? (
        <>
          <mask id={`m-${d.length}-${at}`}>
            <path d={d} stroke="#fff" strokeWidth={width + 4} fill="none" strokeDasharray={`${len * t} ${len}`} />
          </mask>
          <path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray={dash} strokeLinecap="round" mask={`url(#m-${d.length}-${at})`} />
        </>
      ) : (
        <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeDasharray={`${len * t} ${len}`} />
      )}
      {arrow && <path d="M -12 -7 L 2 0 L -12 7" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${tip.x} ${tip.y}) rotate(${ang})`} />}
    </g>
  );
};

/** One token travelling along a path, with a soft comet trail. */
export const Token: React.FC<{ d: string; at: number; dur?: number; color?: string; r?: number; ease?: (t: number) => number; hold?: boolean; children?: React.ReactNode }> = ({
  d,
  at,
  dur = 40,
  color = C.live,
  r = 9,
  ease = E.glide,
  hold,
  children,
}) => {
  const frame = useCurrentFrame();
  const len = useMemo(() => getLength(d), [d]);
  const t = p(frame, at, dur, ease);
  if (frame < at || (!hold && t >= 1)) return null;
  const trail = [0, 0.03, 0.06, 0.09, 0.12];
  return (
    <g>
      {trail.map((k, i) => {
        const pt = getPointAtLength(d, len * Math.max(0, t - k))!;
        return <circle key={i} cx={pt.x} cy={pt.y} r={r * (1 - i * 0.16)} fill={color} opacity={i === 0 ? 1 : 0.28 - i * 0.05} />;
      })}
      {children && (() => {
        const pt = getPointAtLength(d, len * t)!;
        return <g transform={`translate(${pt.x} ${pt.y})`}>{children}</g>;
      })()}
    </g>
  );
};

/** A steady flow of tokens along a path between two frames; `every` frames per token. */
export const Flow: React.FC<{ d: string; from: number; to: number; every?: number; dur?: number; color?: string | ((i: number) => string | null); r?: number }> = ({
  d,
  from,
  to,
  every = 8,
  dur = 50,
  color = C.live,
  r = 6,
}) => {
  const frame = useCurrentFrame();
  const out: React.ReactNode[] = [];
  for (let i = 0, at = from; at < to; i++, at += every) {
    if (frame < at || frame > at + dur) continue;
    const c = typeof color === "function" ? color(i) : color;
    if (c) out.push(<Token key={i} d={d} at={at} dur={dur} color={c} r={r} ease={(v) => v} />);
  }
  return <g>{out}</g>;
};

/** A row of slots that fill left to right as `count` rises. */
export const Queue: React.FC<{ x: number; y: number; slots: number; count: number; size?: number; gap?: number; color?: string; label?: string }> = ({
  x,
  y,
  slots,
  count,
  size = 26,
  gap = 8,
  color = C.live,
  label,
}) => (
  <g transform={`translate(${x} ${y})`}>
    {Array.from({ length: slots }, (_, i) => {
      const f = Math.max(0, Math.min(1, count - i));
      return (
        <g key={i} transform={`translate(${i * (size + gap)} 0)`}>
          <rect width={size} height={size} rx={6} fill="none" stroke={C.line} strokeWidth={1.5} />
          <rect x={size / 2 - (size / 2) * f} y={size / 2 - (size / 2) * f} width={size * f} height={size * f} rx={6 * f} fill={color} />
        </g>
      );
    })}
    {label && (
      <text x={slots * (size + gap) + 10} y={size * 0.72} fontFamily={F.mono} fontSize={T.small} fill={C.mute}>
        {label}
      </text>
    )}
  </g>
);

/** A number that eases to its target, formatted by `fmt`. */
export const Counter: React.FC<{ x: number; y: number; from: number; to: number; at: number; dur?: number; fmt?: (v: number) => string; size?: number; color?: string; anchor?: "start" | "middle" | "end"; font?: string; ease?: (t: number) => number }> = ({
  x,
  y,
  from,
  to,
  at,
  dur = 60,
  fmt = (v) => Math.round(v).toLocaleString("en-US"),
  size = 48,
  color = C.paper,
  anchor = "middle",
  font = F.mono,
  ease = E.glide,
}) => {
  const frame = useCurrentFrame();
  const v = from + (to - from) * p(frame, at, dur, ease);
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={font} fontWeight={500} fontSize={size} fill={color} style={{ fontVariantNumeric: "tabular-nums" }}>
      {fmt(v)}
    </text>
  );
};

/** Animated check mark (pass) or cross (fail) inside a ring. */
export const Verdict: React.FC<{ x: number; y: number; at: number; ok?: boolean; r?: number }> = ({ x, y, at, ok = true, r = 22 }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 30, E.snap);
  const d = p(frame, at + 6, 24);
  if (a <= 0) return null;
  const col = ok ? C.ok : C.bad;
  const mark = ok ? `M ${-r * 0.42} 0 L ${-r * 0.1} ${r * 0.32} L ${r * 0.45} ${-r * 0.35}` : `M ${-r * 0.35} ${-r * 0.35} L ${r * 0.35} ${r * 0.35} M ${r * 0.35} ${-r * 0.35} L ${-r * 0.35} ${r * 0.35}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${a})`}>
      <circle r={r} fill={col} opacity={0.16} />
      <circle r={r} fill="none" stroke={col} strokeWidth={2.5} />
      <path d={mark} fill="none" stroke={col} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${d} 1`} />
    </g>
  );
};

export type Segment = { label: string; value: number; color?: string; at?: number };
/** Stacked timing bar: segments grow in left to right (each at its own cue, or staggered), labels under each, total at the end. */
export const StackBar: React.FC<{ x: number; y: number; w: number; h?: number; at: number; segments: Segment[]; total?: string; stagger?: number; unit?: string }> = ({
  x,
  y,
  w,
  h = 56,
  at,
  segments,
  total,
  stagger = 18,
  unit = "ms",
}) => {
  const frame = useCurrentFrame();
  const sum = segments.reduce((s, g) => s + g.value, 0);
  let cx = 0;
  return (
    <g transform={`translate(${x} ${y})`} opacity={p(frame, at - 10, 20)}>
      <rect width={w} height={h} rx={h / 2} fill={C.panel} stroke={C.line} strokeWidth={1.5} />
      {segments.map((g, i) => {
        const sw = (g.value / sum) * w;
        const t = p(frame, g.at ?? at + i * stagger, 30, E.glide);
        const left = cx;
        cx += sw;
        if (t <= 0) return null;
        const c = g.color ?? [C.cool, C.violet, C.live, C.ok, C.claude][i % 5];
        return (
          <g key={i}>
            <rect x={left + 3} y={3} width={Math.max(0, sw * t - 6)} height={h - 6} rx={(h - 6) / 2} fill={c} opacity={0.85} />
            <text x={left + sw / 2} y={h + 50} textAnchor="middle" fontFamily={F.sans} fontWeight={600} fontSize={T.small} fill={C.paper} opacity={t}>
              {g.label}
            </text>
            <text x={left + sw / 2} y={h + 88} textAnchor="middle" fontFamily={F.mono} fontSize={T.small} fill={C.mute} opacity={t}>
              {g.value}
              {unit}
            </text>
          </g>
        );
      })}
      {total && (
        <text x={w + 28} y={h / 2 + 14} fontFamily={F.mono} fontWeight={500} fontSize={T.label} fill={C.paper} opacity={p(frame, at + segments.length * stagger + 10, 30)}>
          {total}
        </text>
      )}
    </g>
  );
};
