import React from "react";
import { Camera, Label, Text, type CamShot } from "./stage";
import { C, E, F } from "./theme";
import { mix, p, useCurrentFrame } from "./time";

/** JetBrains Mono advance, in em. */
export const MW = 0.6;
/** Raised card fill: bright enough to read as a surface on the Nightfield ground. */
export const CARD = "#28334D";
export const tagW = (text: string, size: number) => text.length * size * MW + size * 1.3;
/** Centre x of character i in a mono string of `n` chars centred on cx. */
export const charX = (cx: number, n: number, i: number, size: number) => cx - (n * size * MW) / 2 + (i + 0.5) * size * MW;

/** A name chip: mono text in a rounded tag, optional sub line (its stable id) underneath. */
export const Tag: React.FC<{
  x: number;
  y: number;
  text: string;
  at: number;
  out?: number;
  color?: string;
  size?: number;
  sub?: string;
  subAt?: number;
  subColor?: string;
  fill?: number;
  dashed?: boolean;
  spans?: [string, string][];
  dim?: number;
}> = ({ x, y, text, at, out = Infinity, color = C.live, size = 56, sub, subAt, subColor = C.mute, fill = 0.32, dashed, spans, dim = 1 }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 30) * (1 - p(f, out, 20));
  if (a <= 0) return null;
  const w = tagW(text, size);
  const h = size * 1.7;
  const subSize = Math.max(36, size * 0.5);
  return (
    <g opacity={a * dim} transform={`translate(${x} ${y + (1 - a) * 14}) scale(${0.94 + 0.06 * a})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h * 0.28} fill={color} fillOpacity={fill} stroke={color} strokeWidth={3} strokeDasharray={dashed ? "14 10" : undefined} />
      <text x={0} y={size * 0.35} textAnchor="middle" fontFamily={F.mono} fontSize={size} fill={C.white} xmlSpace="preserve">
        {spans
          ? spans.map(([s, c], i) => (
              <tspan key={i} fill={c}>
                {s}
              </tspan>
            ))
          : text}
      </text>
      {sub && (
        <text y={h / 2 + subSize * 1.25} textAnchor="middle" fontFamily={F.mono} fontSize={subSize} fill={subColor} opacity={p(f, subAt ?? at, 24)}>
          {sub}
        </text>
      )}
    </g>
  );
};

const SQL_KEYWORDS =
  "SELECT|FROM|WHERE|AND|OR|NOT|NULL|IS|IN|AS|ON|JOIN|LEFT|INNER|GROUP|BY|ORDER|LIMIT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|UNIQUE|KEY|PRIMARY|ALTER|DROP|IF|CASE|WHEN|THEN|ELSE|END|GENERATED|ALWAYS|VIRTUAL|STORED|BINARY|COLLATE|CONCAT|SUBSTRING|CHAR_LENGTH|LOWER|UPPER|COUNT|EXISTS";
const SQL_TOKEN = new RegExp(`(--.*$)|('[^']*')|(\\$\\{[^}]*\\})|\\b(${SQL_KEYWORDS})\\b`, "g");
/** Split one SQL line into coloured spans: comments, string literals (label names), template params, keywords. */
export const sqlSpans = (line: string) => {
  const out: [string, string][] = [];
  let last = 0;
  for (const m of line.matchAll(SQL_TOKEN)) {
    if (m.index > last) out.push([line.slice(last, m.index), C.paper]);
    let c = C.cool;
    if (m[1]) c = C.mute;
    else if (m[2]) c = C.live;
    else if (m[3]) c = C.claude;
    out.push([m[0], c]);
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push([line.slice(last), C.paper]);
  return out;
};

export type Mark = { line: number; at: number; color: string; out?: number };
/** SQL card that types itself in, with line highlights and an optional squiggle under columns [c0, c1). */
export const Sql: React.FC<{
  x: number;
  y: number;
  w: number;
  lines: string[];
  at: number;
  title?: string;
  size?: number;
  marks?: Mark[];
  squiggle?: { line: number; c0: number; c1: number; at: number };
}> = ({ x, y, w, lines, at, title, size = 44, marks = [], squiggle }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 20);
  if (a <= 0) return null;
  const lh = size * 1.5;
  const top = title ? 66 : 20;
  const h = top + lines.length * lh + 22;
  const cw = size * MW;
  let budget = Math.max(0, (f - at) * 1.6);
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 14})`}>
      <rect x={4} y={14} width={w} height={h} rx={16} fill="#000" opacity={0.3} />
      <rect width={w} height={h} rx={16} fill={CARD} stroke="#3A4766" strokeWidth={1.5} />
      {title && (
        <>
          <circle cx={28} cy={34} r={7} fill={C.claude} />
          <text x={46} y={44} fontFamily={F.mono} fontSize={30} fill={C.mute}>
            {title}
          </text>
          <line x1={0} x2={w} y1={62} y2={62} stroke="#3A4766" />
        </>
      )}
      {marks.map((m, i) => {
        const t = p(f, m.at, 20) * (1 - p(f, m.out ?? Infinity, 20));
        if (t <= 0) return null;
        return <rect key={i} x={8} y={top + m.line * lh + 2} width={(w - 16) * t} height={lh - 4} rx={8} fill={m.color} opacity={0.26} />;
      })}
      {lines.map((ln, i) => {
        const shown = ln.slice(0, Math.max(0, Math.floor(budget)));
        budget -= ln.length + 6;
        return (
          <text key={i} x={28} y={top + i * lh + size * 1.05} fontFamily={F.mono} fontSize={size} xmlSpace="preserve">
            {sqlSpans(shown).map(([s, c], k) => (
              <tspan key={k} fill={c}>
                {s}
              </tspan>
            ))}
          </text>
        );
      })}
      {squiggle && p(f, squiggle.at, 24) > 0 && (
        <path
          d={Array.from({ length: Math.round(((squiggle.c1 - squiggle.c0) * cw) / 12) + 1 }, (_, k) => `${k ? "L" : "M"} ${28 + squiggle.c0 * cw + k * 12} ${top + squiggle.line * lh + size * 1.28 + (k % 2 ? 6 : -2)}`).join(" ")}
          pathLength={1}
          strokeDasharray={`${p(f, squiggle.at, 24)} 1`}
          fill="none"
          stroke={C.bad}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      )}
    </g>
  );
};

/** A ring that pops on around a point. */
export const Ring: React.FC<{ x: number; y: number; r: number; at: number; out?: number; color?: string }> = ({ x, y, r, at, out = Infinity, color = C.live }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 24, E.snap) * (1 - p(f, out, 20));
  if (a <= 0) return null;
  return <circle cx={x} cy={y} r={r * (0.6 + 0.4 * a)} fill="none" stroke={color} strokeWidth={5} opacity={Math.min(1, a)} />;
};

/** A plain outlined panel with a heading label. */
export const Panel: React.FC<{ x: number; y: number; w: number; h: number; at: number; title: string; color: string; dashed?: boolean }> = ({ x, y, w, h, at, title, color, dashed }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 30);
  if (a <= 0) return null;
  return (
    <g opacity={a}>
      <rect x={x} y={y} width={w} height={h} rx={22} fill={C.panel} fillOpacity={0.6} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "16 12" : undefined} />
      <Label x={x + 36} y={y + 62} text={title} anchor="start" color={color} />
    </g>
  );
};

/** One beat: fades in and out around its own camera. */
export const Scene: React.FC<{ from: number; to: number; shots: CamShot[]; children: React.ReactNode }> = ({ from, to, shots, children }) => {
  const f = useCurrentFrame();
  if (f < from - 1 || f > to + 1) return null;
  const o = p(f, from, 18) * (1 - p(f, to - 18, 18, E.glide));
  return (
    <g opacity={o}>
      <Camera shots={shots}>{children}</Camera>
    </g>
  );
};

/** Fades a group in at `at` and out at `out`. */
export const Show: React.FC<{ at: number; out?: number; children: React.ReactNode }> = ({ at, out = Infinity, children }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 24) * (1 - p(f, out, 20));
  if (a <= 0) return null;
  return <g opacity={a}>{children}</g>;
};

/** A filled box with a centred title and optional mono sub line. */
export const Box: React.FC<{ x: number; y: number; w: number; h: number; at: number; label: string; sub?: string; color: string; size?: number }> = ({ x, y, w, h, at, label, sub, color, size = 42 }) => (
  <Show at={at}>
    <rect x={x} y={y} width={w} height={h} rx={20} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2.5} />
    <Text x={x + w / 2} y={y + (sub ? h / 2 - 2 : h / 2 + size * 0.35)} size={size} weight={600} color={C.white} anchor="middle">
      {label}
    </Text>
    {sub && (
      <Text x={x + w / 2} y={y + h / 2 + 42} mono size={30} color={C.paper} anchor="middle">
        {sub}
      </Text>
    )}
  </Show>
);

/** A row of character cells, for counting characters. */
export const Cells: React.FC<{ x: number; y: number; chars: string; at: number; color: (i: number) => string; dim?: (i: number) => number }> = ({ x, y, chars, at, color, dim }) => {
  const f = useCurrentFrame();
  return (
    <g>
      {[...chars].map((ch, i) => {
        const a = p(f, at + i * 3, 20);
        if (a <= 0) return null;
        const c = color(i);
        return (
          <g key={i} opacity={a * (dim ? dim(i) : 1)} transform={`translate(${x + i * 78} ${y + (1 - a) * 10})`}>
            <rect width={72} height={80} rx={10} fill={c} fillOpacity={0.32} stroke={c} strokeWidth={2.5} />
            <text x={36} y={56} textAnchor="middle" fontFamily={F.mono} fontSize={48} fill={C.white}>
              {ch}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** Horizontal dimension bracket with a label above or below. */
export const Dim: React.FC<{ x0: number; x1: number; y: number; at: number; text: string; below?: boolean; color: string }> = ({ x0, x1, y, at, text, below, color }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 30);
  if (a <= 0) return null;
  const t = below ? 14 : -14;
  const w = (x1 - x0) * a;
  return (
    <g opacity={a}>
      <path d={`M ${x0} ${y + t} L ${x0} ${y} L ${x0 + w} ${y} ${a > 0.98 ? `L ${x1} ${y + t}` : ""}`} fill="none" stroke={color} strokeWidth={3} />
      <text x={mix(x0, x1, 0.5)} y={below ? y + 52 : y - 18} textAnchor="middle" fontFamily={F.mono} fontSize={40} fill={color}>
        {text}
      </text>
    </g>
  );
};

/** Horizontal bar that grows in, then eases from `from` to `to` (dashed outline keeps the old value). */
export const Bar: React.FC<{ x: number; y: number; from: number; to: number; at: number; shrink: number; w: number }> = ({ x, y, from, to, at, shrink, w }) => {
  const f = useCurrentFrame();
  const a = p(f, at, 30);
  if (a <= 0) return null;
  const v = mix(from, to, p(f, shrink, 50, E.glide));
  const c = f >= shrink ? C.ok : C.paper;
  return (
    <g opacity={a}>
      <rect x={x} y={y} width={w} height={90} rx={14} fill="none" stroke={C.dim} strokeWidth={2} strokeDasharray="10 8" />
      <rect x={x} y={y} width={((w * v) / from) * p(f, at, 40)} height={90} rx={14} fill={c} fillOpacity={0.5} stroke={c} strokeWidth={2} />
    </g>
  );
};
