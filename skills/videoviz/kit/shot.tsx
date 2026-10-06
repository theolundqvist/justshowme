import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, OffthreadVideo, Sequence } from "remotion";
import { getLength, getPointAtLength, getTangentAtLength } from "@remotion/paths";
import { C, E, F, T, col } from "./theme";
import { p, useCurrentFrame, useRenderFrameOf } from "./time";
import { measure } from "./stage";

/** An SVG <image> that holds the render until the file has loaded, so published frames never catch it blank. */
export const SvgImage: React.FC<{ href: string; width: number; height: number; x?: number; y?: number; fit?: "slice" | "meet"; filter?: string }> = ({ href, width, height, x = 0, y = 0, fit = "slice", filter }) => {
  const [handle] = useState(() => delayRender(`image ${href}`));
  useEffect(() => {
    const img = new Image();
    img.onload = img.onerror = () => continueRender(handle);
    img.src = href;
  }, [href, handle]);
  return <image href={href} x={x} y={y} width={width} height={height} preserveAspectRatio={`xMidYMid ${fit}`} filter={filter} />;
};

export type View = { at: number; x: number; y: number; zoom: number; dur?: number };

/**
 * Real product imagery as a first-class shot: a screenshot (or footage) of natural size iw×ih, framed at (x, y, w, h).
 * `view` pans and zooms inside the frame; (x, y) is the image point (in image pixels) at frame centre.
 * Children draw in image pixels, so Spot / Arrow / Callout stay pinned to the pixels they point at while the view moves.
 */
export const Screenshot: React.FC<{
  src: string;
  iw: number;
  ih: number;
  x: number;
  y: number;
  w: number;
  h: number;
  at?: number;
  out?: number;
  video?: boolean;
  view?: View[];
  title?: string;
  titleSize?: number;
  radius?: number;
  children?: React.ReactNode;
}> = ({ src, iw, ih, x, y, w, h, at = 0, out = Infinity, video, view, title, titleSize = T.small, radius = 18, children }) => {
  const frame = useCurrentFrame();
  const toFrame = useRenderFrameOf();
  const a = p(frame, at, 36) * (1 - p(frame, out, 24));
  if (a <= 0) return null;
  const fit = Math.max(w / iw, h / ih);
  const vs = view ?? [{ at: 0, x: iw / 2, y: ih / 2, zoom: 1 }];
  let vx = vs[0].x, vy = vs[0].y, vz = vs[0].zoom, moving = false;
  for (let i = 1; i < vs.length; i++) {
    const t = p(frame, vs[i].at, vs[i].dur ?? 60, E.glide);
    if (t <= 0) break;
    if (t < 1) moving = true;
    vx += (vs[i].x - vx) * t;
    vy += (vs[i].y - vy) * t;
    vz = Math.exp(Math.log(vz) + (Math.log(vs[i].zoom) - Math.log(vz)) * t);
  }
  const s = fit * vz;
  const id = `shot-${Math.round(x)}-${Math.round(y)}`;
  const bar = title ? titleSize * 1.8 : 0;
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 18})`} data-moving={moving ? 1 : undefined}>
      <rect x={-8} y={10} width={w + 16} height={h + bar + 16} rx={radius + 6} fill="#000" opacity={0.45} />
      <rect width={w} height={h + bar} rx={radius} fill={C.panel} stroke={C.line} strokeWidth={2} />
      {title && (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={26 + i * 22} cy={bar / 2} r={7} fill={C.line} />
          ))}
          <text x={w - 22} y={bar / 2 + titleSize * 0.36} textAnchor="end" fontFamily={F.mono} fontSize={titleSize} fill={C.mute}>
            {title}
          </text>
        </>
      )}
      <clipPath id={id}>
        <rect y={bar} width={w} height={h} rx={title ? 4 : radius} />
      </clipPath>
      <rect y={bar} width={w} height={h} fill="none" data-cliprect />
      {video && (
        // Chromium ignores an SVG clipPath around a <video> layer once the clip is offset, so video clips with HTML overflow instead.
        <foreignObject y={bar} width={w} height={h}>
          <div style={{ width: w, height: h, overflow: "hidden", borderRadius: title ? 4 : radius }}>
            <div style={{ width: iw, height: ih, transformOrigin: "0 0", transform: `translate(${w / 2}px, ${h / 2}px) scale(${s}) translate(${-vx}px, ${-vy}px)` }}>
              <Sequence from={toFrame(at)} layout="none">
                <OffthreadVideo src={src} muted style={{ width: iw, height: ih, display: "block" }} />
              </Sequence>
            </div>
          </div>
        </foreignObject>
      )}
      <g clipPath={`url(#${id})`}>
        <g transform={`translate(${w / 2} ${bar + h / 2}) scale(${s}) translate(${-vx} ${-vy})`} data-scale={s}>
          {!video && <SvgImage href={src} width={iw} height={ih} />}
          <ScaleContext.Provider value={s}>{children}</ScaleContext.Provider>
        </g>
      </g>
    </g>
  );
};

const ScaleContext = React.createContext(1);
/** Image pixels per screen pixel inside a Screenshot, so strokes and type keep their on-screen size while zoomed. */
const useInv = () => 1 / React.useContext(ScaleContext);

/** Dim everything but a rectangle of the image and ring it: the "look here" move. */
export const Spot: React.FC<{ x: number; y: number; w: number; h: number; at: number; out?: number; color?: string; dim?: number; r?: number }> = ({
  x,
  y,
  w,
  h,
  at,
  out = Infinity,
  color = "live",
  dim = 0.62,
  r = 10,
}) => {
  const frame = useCurrentFrame();
  const inv = useInv();
  const a = p(frame, at, 30) * (1 - p(frame, out, 24));
  const ring = p(frame, at + 6, 36);
  if (a <= 0) return null;
  const pad = 8 * inv;
  const m = `spot-${x}-${y}-${w}`;
  return (
    <g>
      <mask id={m}>
        <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill="#fff" />
        <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={r * inv} fill="#000" />
      </mask>
      <rect x={-1e4} y={-1e4} width={2e4} height={2e4} fill={C.bg} opacity={dim * a} mask={`url(#${m})`} />
      <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx={r * inv} fill="none" stroke={col(color)} strokeWidth={4 * inv} pathLength={1} strokeDasharray={`${ring} 1`} opacity={a} data-kind="mark" />
    </g>
  );
};

/** A highlighter sweep across a rectangle (text line, row, value). */
export const Sweep: React.FC<{ x: number; y: number; w: number; h: number; at: number; dur?: number; out?: number; color?: string }> = ({ x, y, w, h, at, dur = 30, out = Infinity, color = "live" }) => {
  const frame = useCurrentFrame();
  const t = p(frame, at, dur, E.glide) * (1 - p(frame, out, 20));
  if (t <= 0) return null;
  return <rect x={x} y={y} width={w * t} height={h} rx={h * 0.18} fill={col(color)} opacity={0.3} style={{ mixBlendMode: "screen" }} data-kind="mark" />;
};

/** An arrow that draws on from `from` to `to`, curving by `bend` (fraction of its length). Works in stage or image space. */
export const Arrow: React.FC<{ from: [number, number]; to: [number, number]; at: number; dur?: number; out?: number; bend?: number; color?: string; width?: number }> = ({
  from,
  to,
  at,
  dur = 30,
  out = Infinity,
  bend = 0.2,
  color = "live",
  width = 5,
}) => {
  const frame = useCurrentFrame();
  const inv = useInv();
  const [x0, y0] = from, [x1, y1] = to;
  const cx = (x0 + x1) / 2 - (y1 - y0) * bend, cy = (y0 + y1) / 2 + (x1 - x0) * bend;
  const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
  const len = useMemo(() => getLength(d), [d]);
  const t = p(frame, at, dur, E.glide);
  const o = 1 - p(frame, out, 20);
  if (t <= 0 || o <= 0) return null;
  const tip = getPointAtLength(d, len * t);
  const tan = getTangentAtLength(d, len * t);
  const ang = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
  const c = col(color);
  const sw = width * inv;
  return (
    <g opacity={o} data-kind="mark">
      <path d={d} stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${len * t} ${len}`} />
      <path d={`M ${-20 * inv} ${-12 * inv} L ${2 * inv} 0 L ${-20 * inv} ${12 * inv}`} fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${tip.x} ${tip.y}) rotate(${ang})`} />
    </g>
  );
};

/** A label on a dark tag at (x, y), optionally with a leader line to `to`. Keeps its on-screen size inside a zoomed Screenshot. */
export const Callout: React.FC<{ x: number; y: number; text: string; at: number; out?: number; to?: [number, number]; color?: string; size?: number; anchor?: "start" | "middle" | "end" }> = ({
  x,
  y,
  text,
  at,
  out = Infinity,
  to,
  color = "live",
  size = T.label,
  anchor = "start",
}) => {
  const frame = useCurrentFrame();
  const inv = useInv();
  const a = p(frame, at, 30) * (1 - p(frame, out, 20));
  if (a <= 0) return null;
  const fs = size * inv;
  const tw = measure(text, fs, `600 ${fs}px ${F.sans}`) + fs;
  const bx = anchor === "start" ? x : anchor === "middle" ? x - tw / 2 : x - tw;
  const c = col(color);
  return (
    <g opacity={a}>
      {to && <line x1={x} y1={y} x2={to[0]} y2={to[1]} stroke={c} strokeWidth={3 * inv} pathLength={1} strokeDasharray={`${p(frame, at, 30)} 1`} />}
      {to && <circle cx={to[0]} cy={to[1]} r={7 * inv} fill={c} />}
      <rect x={bx} y={y - fs * 0.85} width={tw} height={fs * 1.5} rx={fs * 0.3} fill={C.bg} opacity={0.88} stroke={c} strokeWidth={2 * inv} data-kind="mark" />
      <text x={bx + fs * 0.5} y={y + fs * 0.2} fontFamily={F.sans} fontWeight={600} fontSize={fs} fill={C.paper} data-role="label">
        {text}
      </text>
    </g>
  );
};
