import React from "react";
import { C, E, H, W } from "./theme";
import { p, useCurrentFrame } from "./time";

/** Full-frame colour flash that decays; the crash hit. */
export const Flash: React.FC<{ at: number; color?: string; strength?: number; dur?: number }> = ({ at, color = C.bad, strength = 0.35, dur = 40 }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  const t = 1 - p(frame, at, dur, E.settle);
  return <rect width={W} height={H} fill={color} opacity={strength * t} />;
};

/** Rewind: horizontal scan bars sweep upward and a ⟲ glyph spins, over `dur` frames. */
export const Rewind: React.FC<{ at: number; dur?: number; color?: string }> = ({ at, dur = 50, color = C.cool }) => {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  const t = (frame - at) / dur;
  const o = Math.sin(t * Math.PI);
  return (
    <g opacity={o}>
      <rect width={W} height={H} fill={color} opacity={0.06} />
      {Array.from({ length: 14 }, (_, i) => {
        const yy = ((1 - t) * H * 1.5 + i * 90) % (H + 80) - 40;
        return <rect key={i} x={0} y={yy} width={W} height={2 + (i % 3)} fill={color} opacity={0.18} />;
      })}
      <g transform={`translate(${W - 120} 110) rotate(${-t * 540})`}>
        <path d="M 26 0 A 26 26 0 1 1 18 -19" stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M 8 -26 L 20 -20 L 12 -8" stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </g>
  );
};

/** Before/after: a vertical wipe reveals `after` over `before` inside a box. */
export const BeforeAfter: React.FC<{ x: number; y: number; w: number; h: number; at: number; before: React.ReactNode; after: React.ReactNode; dur?: number; id: string }> = ({
  x,
  y,
  w,
  h,
  at,
  before,
  after,
  dur = 50,
  id,
}) => {
  const frame = useCurrentFrame();
  const t = p(frame, at, dur, E.glide);
  const cut = w * t;
  return (
    <g transform={`translate(${x} ${y})`}>
      <clipPath id={`ba-a-${id}`}>
        <rect x={cut} y={0} width={w - cut} height={h} />
      </clipPath>
      <clipPath id={`ba-b-${id}`}>
        <rect x={0} y={0} width={cut} height={h} />
      </clipPath>
      <g clipPath={`url(#ba-a-${id})`}>{before}</g>
      <g clipPath={`url(#ba-b-${id})`}>{after}</g>
      {t > 0 && t < 1 && <line x1={cut} x2={cut} y1={-10} y2={h + 10} stroke={C.paper} strokeWidth={2} opacity={0.8} />}
    </g>
  );
};
