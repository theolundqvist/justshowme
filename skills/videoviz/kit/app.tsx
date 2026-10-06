import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Cues, CuesContext, TICK, type Timeline } from "./time";

/** What a composition file declares next to its default export. */
export type Meta = {
  /** video: narrated, length from timeline.json. pointer: looping near-still GIF. still: one PNG. */
  kind?: "video" | "pointer" | "still";
  seconds?: number;
  fps?: number;
  width?: number;
  /** Extra moments to lint besides the automatic cue points, in ticks (cue frames). */
  checks?: number[];
};

export type Resolved = { kind: "video" | "pointer" | "still"; fps: number; frames: number; width: number; height: number; checks: number[] };

/** Duration, fps and lint frames of one composition, from its meta and the narration timeline. */
export const resolve = (meta: Meta = {}, tl?: Timeline | null): Resolved => {
  const kind = meta.kind ?? (tl ? "video" : "pointer");
  const fps = meta.fps ?? (kind === "pointer" ? 20 : tl?.fps ?? 30);
  const frames = kind === "still" ? 1 : kind === "video" && tl ? Math.ceil(tl.total * fps) : Math.round((meta.seconds ?? 5) * fps);
  const width = meta.width ?? (kind === "pointer" ? 1280 : 1920);
  let checks: number[];
  if (kind === "still") checks = [0];
  else if (kind === "pointer") checks = [Math.round(frames * 0.5), frames - 1];
  else
    checks = tl!.beats.flatMap((b) => {
      const ends = b.words.filter((w) => /[.?!]$/.test(w.w)).map((w) => w.e);
      return ends.map((e) => Math.min(frames - 1, Math.round((b.start + e + 0.4) * fps)));
    });
  return { kind, fps, frames, width, height: Math.round((width * 9) / 16), checks: [...new Set([...checks, ...(meta.checks ?? []).map((t) => Math.round((t * fps) / TICK))])].sort((a, b) => a - b) };
};

/** Wraps a scene with its cue sheet and, for narrated videos, the mixed soundtrack. */
export const Main: React.FC<{ Scene: React.FC; tl: Timeline | null; audio: boolean }> = ({ Scene, tl, audio }) => {
  const cues = useMemo(() => (tl ? new Cues(tl, TICK) : null), [tl]);
  return (
    <CuesContext.Provider value={cues}>
      <AbsoluteFill>
        <Scene />
        {audio && tl && <Audio src={staticFile(tl.audio ?? "audio/mix.m4a")} />}
      </AbsoluteFill>
    </CuesContext.Provider>
  );
};
