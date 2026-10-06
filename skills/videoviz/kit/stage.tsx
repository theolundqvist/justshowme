import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { C, E, F, H, T, W, col } from "./theme";
import { hash, p, useCurrentFrame } from "./time";

/** Full-frame 1920×1080 SVG with the house ground: ink gradient, drifting dot field, vignette. Output size only scales it. */
/** `still` freezes the dot drift: pointers loop as GIFs, where every moving pixel costs size. */
export const Stage: React.FC<{ children: React.ReactNode; tint?: string; html?: React.ReactNode; still?: boolean }> = ({ children, tint, html, still }) => {
  const frame = useCurrentFrame();
  const drift = still ? 0 : frame * 0.08;
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: F.sans }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute" }} data-stage>
        <defs>
          <radialGradient id="stage-glow" cx="50%" cy="45%" r="75%">
            <stop offset="0%" stopColor={tint ?? "#16203A"} />
            <stop offset="100%" stopColor={C.bg} />
          </radialGradient>
          <pattern id="stage-dots" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform={`translate(${drift % 48} ${(drift * 0.5) % 48})`}>
            <circle cx="24" cy="24" r="1.1" fill="#233052" />
          </pattern>
          <radialGradient id="stage-vig" cx="50%" cy="50%" r="72%">
            <stop offset="65%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="grey">
            <feColorMatrix type="saturate" values="0.15" />
          </filter>
          {Object.entries({ lava: C.claude, bad: C.bad, live: C.live, ok: C.ok, cool: C.cool }).map(([id, c]) => (
            <radialGradient key={id} id={`glow-${id}`}>
              <stop offset="0%" stopColor={c} stopOpacity={0.7} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>
        <rect width={W} height={H} fill="url(#stage-glow)" />
        <rect width={W} height={H} fill="url(#stage-dots)" opacity={0.7} />
        {children}
        <rect width={W} height={H} fill="url(#stage-vig)" pointerEvents="none" />
      </svg>
      {html}
    </AbsoluteFill>
  );
};

export type CamShot = { at: number; x: number; y: number; zoom: number; dur?: number };
export const WIDE: Omit<CamShot, "at"> = { x: W / 2, y: H / 2, zoom: 1 };

/** Camera that glides between shots; (x, y) is the world point at frame centre. Lint skips edge crops while it moves. */
export const Camera: React.FC<{ shots: CamShot[]; children: React.ReactNode; shake?: number }> = ({ shots, children, shake = 0 }) => {
  const frame = useCurrentFrame();
  let x = shots[0].x, y = shots[0].y, z = shots[0].zoom;
  let moving = shake > 0.05;
  for (let i = 1; i < shots.length; i++) {
    const s = shots[i], dur = s.dur ?? 60;
    const t = p(frame, s.at, dur, E.glide);
    if (t <= 0) break;
    if (t < 1 && (s.x !== x || s.y !== y || s.zoom !== z)) moving = true;
    x += (s.x - x) * t;
    y += (s.y - y) * t;
    z = Math.exp(Math.log(z) + (Math.log(s.zoom) - Math.log(z)) * t);
  }
  const sx = shake * noise2D("sx", frame * 0.35, 0) * 18;
  const sy = shake * noise2D("sy", frame * 0.35, 0) * 12;
  return (
    <g transform={`translate(${W / 2 + sx} ${H / 2 + sy}) scale(${z}) translate(${-x} ${-y})`} data-moving={moving ? 1 : undefined}>
      {children}
    </g>
  );
};

/** A hand-drawn underline under [x, x+w] that draws on as `u` goes 0→1. */
export const Scribble: React.FC<{ x: number; y: number; w: number; u: number; color?: string; seed?: number; width?: number }> = ({ x, y, w, u, color = "live", seed = 1, width = 5 }) => {
  if (u <= 0) return null;
  const n = 8;
  let d = "";
  for (let i = 0; i <= n; i++) d += `${i ? " L" : "M"} ${x + (w * i) / n} ${y + (hash(seed, i) - 0.5) * 6 + Math.sin(i * 1.7) * 1.5}`;
  for (let i = n; i >= 0; i -= 2) d += ` L ${x + (w * i) / n + 6} ${y + 7 + (hash(seed + 3, i) - 0.5) * 5}`;
  return <path d={d} pathLength={1} strokeDasharray={`${u} 1`} stroke={col(color)} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />;
};

let ctx2d: CanvasRenderingContext2D | null = null;
/** Width of serif-italic text at `size`, measured with the real font once it has loaded (estimate before that). */
export const measure = (s: string, size: number, font = `italic ${size}px ${F.serif}`) => {
  if (typeof document === "undefined" || !document.fonts?.check(font)) return s.length * size * (font.includes(F.serif) ? 0.36 : 0.56);
  ctx2d ??= document.createElement("canvas").getContext("2d");
  ctx2d!.font = font;
  return ctx2d!.measureText(s).width;
};

/** The one line a beat puts on screen: serif italic key phrase (≤ 6 words), with a hand-drawn underline on `em`. Drawn in screen space. */
export const Caption: React.FC<{ text: string; at: number; out?: number; em?: string; emColor?: string; x?: number; y?: number; size?: number; color?: string }> = ({
  text,
  at,
  out = Infinity,
  em,
  emColor = "live",
  x = W / 2,
  y = 1000,
  size = T.phrase,
  color = C.paper,
}) => {
  const frame = useCurrentFrame();
  const a = p(frame, at, 36) * (1 - p(frame, out, 24));
  if (a <= 0) return null;
  const w = measure(text, size);
  const i = em ? text.indexOf(em) : -1;
  const ex = x - w / 2 + (i >= 0 ? measure(text.slice(0, i), size) : 0);
  return (
    <g opacity={a} data-caption>
      <ellipse cx={x} cy={y - size * 0.3} rx={w * 0.75} ry={size * 1.2} fill="url(#stage-vig)" opacity={0} />
      <text x={x} y={y + (1 - a) * 14} textAnchor="middle" fontFamily={F.serif} fontStyle="italic" fontSize={size} fill={color} letterSpacing={interpolate(a, [0, 1], [5, 0.5])} style={{ paintOrder: "stroke" }} stroke={C.bg} strokeWidth={10} strokeOpacity={0.6}>
        {text}
      </text>
      {i >= 0 && <Scribble x={ex} y={y + size * 0.22} w={measure(em!, size)} u={p(frame, at + 12, 40)} color={emColor} seed={text.length} />}
    </g>
  );
};

/** Kinetic title, words rising in turn, with an optional underline and sub line. */
export const Title: React.FC<{ text: string; at: number; out?: number; x?: number; y?: number; size?: number; sub?: string; underline?: boolean; color?: string }> = ({
  text,
  at,
  out = Infinity,
  x = W / 2,
  y = H / 2,
  size = T.title,
  sub,
  underline = true,
  color = C.paper,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const w = measure(text, size);
  const exit = 1 - p(frame, out, 24);
  if (frame < at || exit <= 0) return null;
  let cx = x - w / 2;
  return (
    <g opacity={exit}>
      {words.map((wd, i) => {
        const u = p(frame, at + i * 5, 40);
        const el = (
          <text key={i} x={cx} y={y + (1 - u) * 26} opacity={u} fontFamily={F.serif} fontStyle="italic" fontSize={size} fill={color}>
            {wd}
          </text>
        );
        cx += measure(wd + " ", size);
        return el;
      })}
      {underline && <Scribble x={x - w / 2} y={y + size * 0.28} w={w} u={p(frame, at + words.length * 5 + 10, 45)} seed={text.length} />}
      {sub && (
        <text x={x} y={y + size * 1.1} textAnchor="middle" fontFamily={F.sans} fontSize={T.body} fill={C.mute} opacity={p(frame, at + 20, 30)}>
          {sub}
        </text>
      )}
    </g>
  );
};

/** Uppercase tracked label, the secondary type voice (a lint "label": 40 px minimum). */
export const Label: React.FC<{ x: number; y: number; text: string; color?: string; size?: number; anchor?: "start" | "middle" | "end"; opacity?: number; weight?: number }> = ({
  x,
  y,
  text,
  color = C.mute,
  size = T.label,
  anchor = "middle",
  opacity = 1,
  weight = 600,
}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={F.sans} fontWeight={weight} fontSize={size} letterSpacing={size * 0.06} fill={col(color)} opacity={opacity} data-role="label">
    {text}
  </text>
);

/** Plain text at a size from the type scale. */
export const Text: React.FC<{ x: number; y: number; children: React.ReactNode; size?: number; color?: string; anchor?: "start" | "middle" | "end"; mono?: boolean; weight?: number; opacity?: number }> = ({
  x,
  y,
  children,
  size = T.body,
  color = C.paper,
  anchor = "start",
  mono,
  weight = 500,
  opacity = 1,
}) => (
  <text x={x} y={y} textAnchor={anchor} fontFamily={mono ? F.mono : F.sans} fontWeight={weight} fontSize={size} fill={col(color)} opacity={opacity}>
    {children}
  </text>
);
