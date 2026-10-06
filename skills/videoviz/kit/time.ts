import { createContext, useContext } from "react";
import { interpolate, useCurrentFrame as useRenderFrame, useVideoConfig, type EasingFunction } from "remotion";
import { E } from "./theme";

export type Word = { w: string; s: number; e: number };
/** voice.py writes word times relative to their beat's start. */
export type Beat = { id: string; start: number; dur: number; words: Word[] };
export type Timeline = { total: number; beats: Beat[]; fps?: number; audio?: string };

/** Scene time is counted in ticks of 1/60 s whatever the render fps, so durations like `p(frame, at, 30)` mean the same half second at 30 or 60 fps. */
export const TICK = 60;
/** Current time in ticks (fractional when rendering below 60 fps). */
export const useCurrentFrame = () => {
  const f = useRenderFrame();
  const { fps } = useVideoConfig();
  return (f * TICK) / fps;
};
/** Render frame of a tick, for Remotion APIs that take real frames (Sequence). */
export const useRenderFrameOf = () => {
  const { fps } = useVideoConfig();
  return (tick: number) => Math.round((tick * fps) / TICK);
};

const NUM: Record<string, string> = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "10": "ten", "20": "twenty", "100": "hundred" };
const norm = (s: string) => {
  const w = s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9']/g, "");
  return NUM[w] ?? w;
};

/** Narration as a cue sheet. `at("typecheck")` is the frame that phrase starts; a missing cue throws, so script edits fail loudly. */
export class Cues {
  readonly words: Word[];
  private w: string[];
  constructor(public tl: Timeline, public fps: number) {
    this.words = tl.beats.flatMap((b) => b.words.map((w) => ({ w: w.w, s: b.start + w.s, e: b.start + w.e })));
    this.w = this.words.map((x) => norm(x.w));
  }
  private find(phrase: string, after: number) {
    const parts = phrase.split(/\s+/).map(norm).filter(Boolean);
    for (let i = 0; i < this.w.length; i++) {
      if (this.words[i].s * this.fps < after) continue;
      if (parts.every((p, k) => this.w[i + k] === p)) return [i, i + parts.length - 1];
    }
    throw new Error(`cue "${phrase}" is not spoken${after ? ` after frame ${after}` : ""}`);
  }
  /** Frame the phrase starts (searching from frame `after`). */
  at = (phrase: string, after = 0) => Math.round(this.words[this.find(phrase, after)[0]].s * this.fps);
  /** Frame the phrase finishes. */
  end = (phrase: string, after = 0) => Math.round(this.words[this.find(phrase, after)[1]].e * this.fps);
  /** Start frame of a beat from script.json. */
  beat = (id: string) => {
    const b = this.tl.beats.find((x) => x.id === id);
    if (!b) throw new Error(`no beat "${id}"`);
    return Math.round(b.start * this.fps);
  };
  get duration() {
    return Math.ceil(this.tl.total * this.fps);
  }
}

export const CuesContext = createContext<Cues | null>(null);
/** The narration cue sheet of the current video. */
export const useCues = () => {
  const c = useContext(CuesContext);
  if (!c) throw new Error("useCues() needs a narrated video (timeline.json from voice.py)");
  return c;
};

/** 0→1 progress of a move that starts at frame `from` and lasts `dur` frames. */
export const p = (frame: number, from: number, dur = 30, ease: EasingFunction = E.settle) =>
  !Number.isFinite(from) ? 0 : interpolate(frame, [from, from + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

/** In at `from`, out at `to`; multiply into opacity. */
export const inOut = (frame: number, from: number, to = Infinity, dur = 24) => Math.min(p(frame, from, dur), 1 - p(frame, to, dur, E.glide));

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Time in ticks, the tick rate and a seconds→ticks helper; the three things every component needs. */
export const useT = () => {
  const f = useCurrentFrame();
  return { f, fps: TICK, s: (sec: number) => Math.round(sec * TICK) };
};

export const hash = (a: number, b = 0) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
