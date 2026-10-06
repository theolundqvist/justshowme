---
name: videoviz
description: Make a narrated explainer video (2–5 min, 1920x1080) of a change, bug or idea in the style of a good database teacher on YouTube: conversational voice, real queries with real results on screen, a camera that pushes into the line being talked about, and one recurring image from cold open to close. A friendly Gemini voice reads a verbatim script, local Whisper checks every take and times every word, and every animation cue is bound to a spoken phrase. A Remotion kit (code cards that type themselves, character cells, dimension brackets, chips with ids, rings, verdicts, counters, gates, flows) renders to a live localhost page with audio and a scrubber; publish renders an MP4 locally or as parallel frame slices joined without re-encoding. Use when someone asks for an explainer video, a narrated walkthrough of a PR, or "explain this like a YouTube video"; for slide stories use pixelviz, for interactive pages use visualize.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

**Arguments:** `$ARGUMENTS`: the topic (a PR, a bug, a design), plus any length or voice request.

`S=<this skill dir>`. Read `references/craft.md` before writing the script: it is a beat-by-beat teardown of a video people loved, and every rule below comes from it.

## Requirements

Node 20+, `ffmpeg`, Python 3, and a `gcloud` login on a project with Vertex AI enabled (Gemini TTS and Lyria music). `sh $S/scripts/new.sh <dir>` installs the kit (`npm ci`) and a venv with `numpy` and `faster-whisper` on first use. ElevenLabs SFX are optional (`ELEVENLABS_API_KEY`; `ELEVENLABS_API_BASE` for a data-residency host); drop `sfx` from the script without one. Remotion is free for individuals and small teams; larger companies need its licence.

## Flow

1. **Facts first.** Write a brief before a word of script: the viewer, the one question the video answers, and a *Verified facts* block. Every fact comes from the code at a named commit, a query you ran, or a run you observed (CI log, benchmark, probe), quoted verbatim. Claims about later behaviour ("after the migration, the next sync…") are traced through the code too, never carried over from an earlier summary. Nothing outside the block goes on screen or into the voice.
2. **Script** (`script.json`): `title`, `voice` (`gemini:Puck`), `style` (the narrator instruction), optional `music` prompt, `beats: [{id, say, lead?, hold?, sfx?: [{at: word, prompt, dur ≥ 0.5, gain?}]}]`. 12–16 beats, 8–25 s each, about 150 wpm. Write for the ear: spell numbers and symbols the way they are said, and rewrite any line whose point is a spelling the ear can't hear. Story shape and voice rules: `references/craft.md`.
3. **Voice pass, in the background:** `$S/.venv/bin/python $S/scripts/voice.py <dir>`. Every beat is read by Gemini 2.5 Pro TTS, transcribed by local Whisper with the script as prompt, and retaken (up to 4 times, then a clear failure) until it is verbatim; Whisper's word times become `timeline.json`. Music (Lyria, looped with crossfades, ducked under speech) and SFX are mixed to −16 LUFS, true peak −1.5 dBTP, in `audio/mix.m4a`. TTS is cached by text, voice and style, so an edit re-bills only the changed beat. `--silent` writes 150 wpm timings with no audio so scenes can be built first; `--audition "<line>" --voices gemini:Puck,gemini:Charon` compares voices (wpm, pauses, pitch spread).
4. **Live page:** `node $S/scripts/dev.mjs <dir> --port <p>` in the background. One Player per composition with audio and a scrubber; it reloads on every save and waits for `timeline.json`.
5. **Scenes** (`video.tsx`): pure functions of `useCurrentFrame()` from `videoviz`, where a frame is a 1/60 s tick at any render fps. `const S = useCues()`; `S.at(phrase, S.beat(id))` is the tick a phrase starts within a beat, `S.end`, `S.beat`, `S.duration`. A cue that is never spoken throws, so script edits fail loudly. Build a cue table per beat first (`q(id, phrase)`), then hang every entrance, camera move, highlight and caption on those cues. The house patterns are in `references/craft.md`.
6. **Check:** `node $S/scripts/check.mjs <dir>` seeks to the end of every spoken sentence and lints the SVG (labels under 40 px, other text under 30 px, text cut by the frame while the camera is still, overlapping text, frames under 4% ink). It exits 1 on any finding and writes `.videoviz/check/sheet.png`.
7. **Look.** Read the sheet, then frames at each beat's first cue and mid-move, as a bored viewer: can I tell in 2 s where to look, does the picture show what the voice says at that moment, is anything crowded, clipped or unexplained, does every number carry a unit? Then listen once end to end. Fix; the page is live.
8. **Publish** only where a live page can't go: `nice -n 19 node $S/scripts/publish.mjs <dir>` renders `out/video.mp4` at 30 fps with the mix. A long video renders faster as parallel slices on several machines or CI jobs: `publish.mjs <dir> --frames A-B` writes a silent `out/video.<A>.mp4` per slice, and `node $S/scripts/join.mjs <dir> video` stream-copies them in order, refuses gaps or overlaps, and lays the mix over the whole video once.

## Kit (`import { … } from "videoviz"`)

Coordinates are the 1920x1080 stage; components take ticks (`at`, `out`) and animate their own entrance and exit.

- **Beats and camera.** `Scene from to shots` fades one beat in and out around its own `Camera`; `shots={[{at, x, y, zoom, dur?}]}` glides between framings and the lint ignores crops while it moves. `Show at out` fades any group. `Stage` is the dark ground with drifting dots and a vignette.
- **Words.** `Caption text em emColor at out` is the serif italic key phrase with a hand-drawn underline under `em`. `Label` (uppercase), `Text`, `Scribble`.
- **Names and code.** `Tag text sub size color dashed spans` is a mono chip with its id underneath; `spans` recolour single characters (the `n` that became `N`). `Sql lines title marks squiggle` is a code card that types itself in with keyword, string and parameter colours, line highlights and a red squiggle under exact columns. `CodeBlock` for other languages. `Cells chars color dim` counts characters one box each; `Dim x0 x1 text` is a dimension bracket ("6 chars"). `charX`, `tagW` and `MW` give mono glyph geometry so a `Ring` can land on one letter.
- **Structure.** `Panel title dashed` (a dashed panel is the future), `Box label sub`, `Node`, `Edge d arrow dash`, `Token d` (a comet along a path), `Flow`, `Queue`, `Gate label sub active done ok`.
- **Verdicts and numbers.** `Verdict ok`, `Ring`, `Flash`, `Cracks`, `Counter from to fmt` (numbers tick, with unit), `Bar from to shrink` (shrinks from a dashed outline of the old value), `StackBar`.
- **Real imagery.** `Screenshot src iw ih view` frames a real capture and pans inside it; `Spot`, `Sweep`, `Arrow`, `Callout` pin to image pixels. Never recreate a product's UI; capture it.
- **Time and colour.** `p(frame, from, dur, ease)`, `mix`, `hash` (no `Math.random`), `E.settle | glide | snap`. One colour per concept for the whole video: `C.live` (amber) the source of truth's data, `C.cool` our system, `C.claude` (orange) code and the change, `C.ok` the fix, `C.bad` failure, `C.mute` context.

## Deliver

- Give the live page link first, then the MP4 path served over HTTP if the viewer is on another machine.
- For a PR, attach the MP4 on a line of its own so GitHub plays it inline. Uploads have size limits: a 4-minute 1080p render is about 40 MB, and a 720p copy (`ffmpeg -i video.mp4 -vf scale=1280:-2 -c:v libx264 -preset slow -crf 30 -tune animation -c:a aac -b:a 96k -movflags +faststart pr.mp4`) is about 6 MB and still crisp.
- Keep sources out of the repository: author in `<worktree>/.scratch/video/<slug>/` or `/tmp/videoviz/<slug>/`.
