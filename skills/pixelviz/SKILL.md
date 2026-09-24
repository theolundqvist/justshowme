---
name: pixelviz
description: Render an explanation, plan, design decision, flow, or bug root-cause as a 1920x1080 slide deck drawn in procedural-film's hand-inked style (boiling ink lines, hatching, stipple, callout lenses and dimension lines on a paper or navy blueprint plate) with crisp native Inter text, whose poster frames double as PR screenshots and whose slides may animate in steps of at most 3 s. Frames are captured deterministically from code, linted for overlaps, containment, clipping, crossing edges and small text, checked for determinism, and exported as PNG posters, a labelled contact sheet and MP4/GIF clips. Use for PR slide stories, bug root-causes and animated explainers; for interactive widgets and scrolling pages use visualize.
allowed-tools: Read, Write, Bash, Glob, Grep
---

**Arguments:** `$ARGUMENTS`: the topic.

If your harness can run a background agent, render there so the conversation stays responsive.

A visual is a drawing you understand by looking: things with spatial meaning, tokens moving along a path, a ring that jams and releases, a bar that dwarfs its partner. A card of text is not a visual.

## Plan

1. **One takeaway**: one plain sentence. If you can't write it, go and learn the subject first.
2. **Beats**: 3–6 slides, one idea each. Name the drawing for each beat in a few words ("event loop ring, jammed brick, lens on the brick"). A beat without a drawing becomes a caption or gets cut.
3. **Plate per beat**: `paper` for story beats (what happened, what it cost, the result), `blueprint` for mechanism beats (how the algorithm or system works).
4. **Motion only when motion is the point**: flow, queueing, ordering, a race, a state transition. Everything else is a still. Give each beat a step of at most 3 s; the viewer pauses at every step so its text can be read and stops on the final state. Moving things never pass over waiting ones: release a queue in exit order.
5. **Traps**: list the misconceptions the drawing must not show.

## Draw

Copy `templates/scenes.html` to the output path and replace only the block between `// ---- scenes` and `// ---- viewer`. The file inlines procedural-film's `lib.js` verbatim (MIT, see `LICENSE-procedural-film`) as `k.L`, then the kit and viewer; keep both unchanged.

- **Look.** Every line is an ink ribbon with pressure, wobble and a 12 fps boil derived from `t`, so stills never boil and replays are identical. Tone comes from hatching, cross-hatching and stipple clipped to the shape, not from gradients. The grain post runs over the art; text is drawn last, crisp, with a plate-coloured halo.
- **Plates.** `plate: 'paper'` gives near-white paper with grain, fibres, mottle, vignette and faint diagonal stripes (`band`: `stripeYellow`, `stripeApricot`, `stripeSage`, `stripeSky`, `stripeSpring`, `stripeCream`); ink and text are `ink`, secondary text `inkSoft`, annotations `annMagenta`/`annBlue`/`annYellow`. `plate: 'blueprint'` gives a navy noisy grid with rulers; lines are `lavender`, text `lineWhite`, heroes `schemHero` (before) and `schemOk` (after), glows additive.
- **Palette.** Colours are keys of the house palette `k.pal` (unknown keys throw), never hex. Pales (`orangePale`, `tealPale`, `redPale`) fill paper shapes; `red`/`orange` are the problem, `teal`/`tealDeep` the fix.
- **Kit (`k`).** Ink: `ink(pts,{color,width,closed,fill,dash,p,arrow})`, `line`, `stroke` (smooth canvas line), `ring`, `arc(cx,cy,r,a0,a1,{arrow})`, `guide`, `construct(cx,cy,r)` (construction circles and rays). Fills: `hatch`, `crossHatch`, `stipple`, `hexLattice(clip,{…,clip:true})`. Light: `glowDot(x,y,r,{rays})`, `halo`. Measure: `ticks(x,y,{length,n,major})`, `dim(id,x1,y1,x2,y2,{label,side})` (dimension line with arrowheads and a linted label). Shapes with lint ids: `box`, `disc`, `cylinder`, `bar`, `region` (lint-only bounds), `text(id,x,y,str,{size,weight,color,align,parent})`, `arrow(fromId,toId,{bend,dash})`, and `lens(id,cx,cy,r,{target,targetR,source,mag,draw})`, a callout circle with a leader to its target that either re-renders the scene magnified around `source` or runs its own `draw(k)`. Helpers: `seg`, `ease`, `lerp`, `along`, `partial`, `twos` (quantize motion to 12 fps), `rectPts`, `ellipse`, seeded `rand`.
- **Scene contract.** `scene({ title, caption, plate, band, duration, steps, poster, draw(k, t) })`. `draw` is a pure function of `t ∈ [0,1]`: no clocks, timers or unseeded randomness. `duration` is 0 for a still; `steps` lists ascending pause points in (0, 1) and every gap between stops is at most 3 s. `poster` is the `t` of the still. The title sits at y 48 and the caption at y 984, so content lives in y 140–952.
- **Text** is crisp native Inter 400/600/700 drawn last, never pixelated, blurred or baked into art; the viewer scales the 1920x1080 canvas by whole numbers when the window has room. Text never sits on a stroke, ring or hatching: a label goes inside its box or clear of it. Sizes: minimum 32 px (caption 36), labels 40–48, title 64, hero numbers 96–144. Integer coordinates only. 3–6 word factual titles, labels of at most 3 words, one caption line of concrete values.
- **The poster is the PR screenshot.** It tells the whole story alone: before and after both visible, every element settled, nothing mid-flight, nothing clipped at the frame edge, no empty third.
- **Rich, one hero.** Every slide has one obvious hero (the counter, the ×-factor, the band) and spends its detail on supporting texture: a lens on the culprit, dimension lines on the measured quantity, hatching for state, construction lines behind the hero. Supporting detail never touches the hero: a lens target, leader or brick clears the ring it annotates.

## Verify

```bash
node <skill-dir>/scripts/capture.mjs <deck.html> <outDir> [--scenes=0,2] [--gif] [--lint-only]
```

It lints every frame, writes `scene-NN.png` posters, `scene-NN.mp4` per scene (stills hold 3 s, steps hold 1 s), `deck.mp4` (re-encoded to a few MB so it fits a PR attachment), `sheet.png` (a labelled contact sheet of every poster plus each step's mid and stop frame) and, with `--gif`, a 960 px `scene-NN.gif` per animated scene rendered without the film grain so it stays a few MB. It re-renders hashed frames in a different order and fails on any mismatch (`DETERMINISM`). It exits non-zero on lint: shapes overlapping or within 8 px unless parented, children outside their parent, anything out of frame, edges crossing a box, text under 32 px or at fractional coordinates, steps over 3 s, page errors. It needs Node, `ffmpeg` on the PATH and Playwright: run `npm i` in the skill directory once, and `npx playwright install --only-shell chromium` there if the browser is missing.

Lint is necessary, not sufficient: verify by looking. Open and read the image of `sheet.png`, every poster and one full-size mid-step frame per animation (`ffmpeg -ss <sec> -i scene-NN.mp4 -frames:v 1 mid.png`; each step stop holds 1 s in the clip); reject a slide that draws a trap, reads slower than two seconds, lacks one obvious hero, overlaps, clips or crowds text, or has dead space. Fix, recapture, re-read until every poster passes.

## Deliver

- **Conversation:** give the takeaway and the beat→drawing list in two or three lines, then open the deck in a browser (or serve its directory with `python3 -m http.server` and give the link). Viewer keys: ←/→ step and pause at each step (→ at the end replays), Space replays, ↑/↓ always change slide; a click or tap steps and, at the end, goes to the next slide.
- **PR:** keep the deck and captures in an ignored scratch folder, regenerate them from scratch after substantive changes and never commit them. Capture with `--gif` and embed the GIF of the slide that explains the core decision, since it autoplays inline (the poster PNG instead when that slide is a still; up to three more only for distinct load-bearing states); GitHub caps images at 10 MB, so embed per-slide GIFs, never a whole-deck GIF. Attach `deck.mp4` below it for the full story; GitHub plays an uploaded MP4 when its URL sits alone on a line. Upload by dragging the files into the PR description, or from the terminal with [`gh-img`](https://github.com/theolundqvist/gh-img) (`gh img --repo owner/repo <paths>` prints the Markdown to paste).

PR prose, commits and issue bodies stay Markdown.
