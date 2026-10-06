import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { Main, resolve, type Meta } from "./app";
import type { Timeline } from "./time";

type Comp = { name: string; mod: { default: React.FC; meta?: Meta } };

declare global {
  interface Window {
    __mv: { comps: { name: string; kind: string; fps: number; frames: number; checks: number[] }[]; seek: (name: string, frame: number) => Promise<void> };
  }
}

const One: React.FC<{ c: Comp; tl: Timeline | null; lint: boolean; refs: Map<string, PlayerRef> }> = ({ c, tl, lint, refs }) => {
  const r = resolve(c.mod.meta, tl);
  const ref = useRef<PlayerRef>(null);
  useEffect(() => {
    if (ref.current) refs.set(c.name, ref.current);
  });
  if (r.kind === "video" && !tl) return <div className="wait">waiting for timeline.json: run voice.py (or voice.py --silent)</div>;
  return (
    <Player
      ref={ref}
      component={Main}
      inputProps={{ Scene: c.mod.default, tl, audio: r.kind === "video" }}
      durationInFrames={r.frames}
      fps={r.fps}
      compositionWidth={1920}
      compositionHeight={1080}
      style={{ width: "100%", borderRadius: lint ? 0 : 12, overflow: "hidden" }}
      controls={!lint}
      loop={r.kind === "pointer"}
      autoPlay={r.kind === "pointer" && !lint}
      clickToPlay={!lint}
      doubleClickToFullscreen
      allowFullscreen
      spaceKeyToPlayOrPause
      numberOfSharedAudioTags={0}
      acknowledgeRemotionLicense
    />
  );
};

/** Live page: one Player per composition, with audio and a scrubber. `?lint=<name>` shows only that one, chrome-free, for check.mjs. */
export const mount = async (list: Comp[]) => {
  const q = new URLSearchParams(location.search);
  const lint = q.get("lint");
  if (lint) document.body.classList.add("lint");
  const res = await fetch("/timeline.json", { cache: "no-store" });
  const tl: Timeline | null = res.ok ? await res.json() : null;
  const refs = new Map<string, PlayerRef>();
  const shown = lint ? list.filter((c) => c.name === lint) : list;
  window.__mv = {
    comps: list.map((c) => ({ name: c.name, ...resolve(c.mod.meta, tl) })),
    seek: async (name, frame) => {
      refs.get(name)!.seekTo(frame);
      await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      await document.fonts.ready;
      await Promise.all([...document.querySelectorAll("image")].map((i) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = i.getAttribute("href")!; })));
      // Footage paints only once its seek lands; lint would otherwise read an empty frame.
      await Promise.all([...document.querySelectorAll("video")].map((v) => (v.readyState >= 2 && !v.seeking ? null : new Promise((ok) => { v.addEventListener("seeked", ok, { once: true }); v.addEventListener("loadeddata", ok, { once: true }); }))));
    },
  };
  createRoot(document.getElementById("root")!).render(
    <>
      {shown.map((c) => (
        <section key={c.name}>
          <h2>{c.name}</h2>
          <One c={c} tl={tl} lint={!!lint} refs={refs} />
        </section>
      ))}
    </>,
  );
};
