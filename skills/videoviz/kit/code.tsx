import React from "react";
import { C, F } from "./theme";
import { p, useCurrentFrame } from "./time";

const KW = /\b(export|default|const|let|return|if|else|for|of|function|import|from|new|true|false)\b/;
const RULES: [RegExp, string][] = [
  [/^\/\/.*/, C.dim],
  [/^"[^"]*"|^'[^']*'|^`[^`]*`/, C.ok],
  [/^\d+(\.\d+)?/, C.live],
  [new RegExp("^" + KW.source), C.violet],
  [/^[A-Za-z_$][\w$]*(?=\()/, C.cool],
  [/^[A-Za-z_$][\w$]*/, C.paper],
  [/^\s+/, C.paper],
  [/^./, C.mute],
];

const tokens = (line: string) => {
  const out: [string, string][] = [];
  let rest = line;
  while (rest) {
    for (const [re, col] of RULES) {
      const m = rest.match(re);
      if (m) {
        out.push([m[0], col]);
        rest = rest.slice(m[0].length);
        break;
      }
    }
  }
  return out;
};

export type Mark = { line: number; at: number; color?: string; out?: number; squiggle?: [number, number] };

/** Code card that types itself in (`cps` chars/frame), with line highlights and error squiggles. */
export const CodeBlock: React.FC<{
  x: number;
  y: number;
  w: number;
  lines: string[];
  at: number;
  title?: string;
  cps?: number;
  size?: number;
  marks?: Mark[];
  accent?: string;
}> = ({ x, y, w, lines, at, title, cps = 2.2, size = 32, marks = [], accent = C.claude }) => {
  const frame = useCurrentFrame();
  const a = p(frame, at - 20, 30);
  if (a <= 0) return null;
  const lh = size * 1.55;
  const top = title ? 76 : 26;
  const h = top + lines.length * lh + 20;
  const cw = size * 0.6;
  let budget = Math.max(0, (frame - at) * cps);
  return (
    <g opacity={a} transform={`translate(${x} ${y + (1 - a) * 16})`}>
      <rect x={4} y={14} width={w} height={h} rx={16} fill="#000" opacity={0.32} />
      <rect width={w} height={h} rx={16} fill="#0E141F" stroke={C.line} strokeWidth={1.5} />
      {title && (
        <>
          <circle cx={26} cy={37} r={7} fill={accent} />
          <text x={44} y={48} fontFamily={F.mono} fontSize={30} fill={C.mute}>
            {title}
          </text>
          <line x1={0} x2={w} y1={66} y2={66} stroke={C.line} />
        </>
      )}
      {marks.map((m, i) => {
        const t = p(frame, m.at, 20) * (1 - p(frame, m.out ?? Infinity, 20));
        if (t <= 0) return null;
        return <rect key={i} x={6} y={top + m.line * lh - 4} width={(w - 12) * t} height={lh} rx={6} fill={m.color ?? C.live} opacity={0.14} />;
      })}
      {lines.map((ln, i) => {
        const shown = ln.slice(0, Math.floor(budget));
        budget -= ln.length + 4;
        let cx = 0;
        return (
          <text key={i} x={24} y={top + i * lh + size * 0.95} fontFamily={F.mono} fontSize={size} xmlSpace="preserve">
            {tokens(shown).map(([s, col], k) => {
              const el = (
                <tspan key={k} x={24 + cx * cw} fill={col}>
                  {s}
                </tspan>
              );
              cx += s.length;
              return el;
            })}
          </text>
        );
      })}
      {marks
        .filter((m) => m.squiggle)
        .map((m, i) => {
          const t = p(frame, m.at, 24);
          if (t <= 0) return null;
          const [c0, c1] = m.squiggle!;
          const x0 = 24 + c0 * cw;
          const len = (c1 - c0) * cw * t;
          const yy = top + m.line * lh + size * 1.2;
          let d = `M ${x0} ${yy}`;
          for (let k = 0; k < len; k += 6) d += ` l 3 ${k % 12 === 0 ? 3 : -3}`;
          return <path key={i} d={d} stroke={m.color ?? C.bad} strokeWidth={2} fill="none" />;
        })}
    </g>
  );
};
