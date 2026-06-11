---
name: visualize
description: Render a plan, concept, design decision, or explanation as a self-contained HTML visual presentation and open it in the browser, instead of writing markdown. The output is a DRAWING — schematic diagram, animated flow, interactive widget, or sketch — with text demoted to labels. Two modes — a keyboard-navigable slide deck (the default for explanations, walkthroughs, decisions, bug root-causes) and a scrolling page (only for dense reference). Use whenever explaining something non-trivial, planning a feature, comparing options, walking through architecture or a flow.
allowed-tools: Read, Write, Bash, Glob, Grep
---

**Arguments:** `$ARGUMENTS` — the topic/subject, optional `--page` to force scrolling-page mode.

This skill assumes a visual learner, and is explicit: **a colored card, a table, or styled text is NOT a visual.** If a panel is just text in a box, you have drawn nothing. A visual is a *shape you understand by looking* — boxes and arrows with spatial meaning, dots moving through a pipeline, a slider that changes a curve, a hand-sketched schematic. The job is to draw the concept, with words reduced to short labels and one-line captions. **Never a paragraph inside a panel.**

## Choosing the mode — default to slides
**Build a slide deck unless you have a specific reason not to.** Slides are gazable and are the right form for almost everything: explaining a concept, walking through a flow or architecture, a design decision, a bug root-cause, anything attached to a PR. A bug root-cause with a flow diagram + evidence is a deck, not a page.

Build a **page** (`--page`, or your judgment) **only** when the content is genuinely *reference you scan and revisit*, not something you walk through: a component/primitive library, one big comparison matrix to study, or many small items that don't each deserve a slide. **When in doubt, slides.** Never fall to a page just because no mode was specified — that's the wrong default.

## Phase 1 — PLAN (front-loaded; it's "what's the drawing?")

Do not open a template yet.

1. **One takeaway.** The single sentence the reader should leave with. Can't write it → you don't understand the thing well enough to draw it. Go learn it first.
2. **Beats.** The minimal set of ideas (usually 3–6) that land the takeaway. One idea per beat.
3. **Pick the drawing for each beat** — the primitive whose shape matches the idea's shape:
   - structure / how-it-fits / mental model → **schematic SVG diagram** (boxes, arrows, spatial layout)
   - process, pipeline, "where things go", state machine → **animated flow** (dots travel paths) or **Mermaid** (flowchart/sequence/state)
   - a relationship, tradeoff curve, "what if I change X" → **interactive widget** (slider/toggle drives a live SVG) — the highest-payoff visual. When a **flag or input changes which paths are live**, reach for a **toggle-gated flow** (checkboxes open/close edges in a diagram) — prefer it whenever the concept is "this setting gates that path."
   - an informal walkthrough, brainstorm, rough mental model → **sketch** (rough.js hand-drawn look)
   - a standard graph (flowchart, sequence, ER, class, gantt) → **Mermaid**, themed to the house palette
   - **a claim that's just true** → a one-line caption. NOT a panel, NOT a card. If a beat can't become one of the drawings above, it isn't a beat — it's a caption or it's cut.
4. **Engine, per concept:** Mermaid for standard graph types (fast, reliable); hand-authored SVG when the layout is custom/spatial; animation when motion *adds meaning* (not decoration); interactive when a parameter or relationship is the point; sketch for an informal feel. Mix freely within one page.
5. **Cull (minimalism, applied to pixels).** Every mark on the canvas must trace to the takeaway. No decorative SVG, no filler labels, no diagram that exists because the slot looked empty. If deleting an element doesn't hurt the takeaway, delete it. A *wrong or disjoint* diagram is worse than prose — precision first.
6. **Skim-test the plan.** For each beat: name the drawing in a few words ("git worktrees → boxes-and-arrows of repo+3 dirs"). If you can't name the drawing, the beat isn't ready. Show the user the beat→drawing list in one line each for anything substantial, then generate.

## Phase 2 — DRAW (start from a working primitive, never freehand)

- **Copy from `references/primitives.html`.** It holds correct, proven snippets for all primitives (diagram kit, animated flow, slider-interactive, toggle-gated flow, sketch, Mermaid) plus the minimal supporting text elements, on the house-style shell. Start from the closest one and adapt its data — do **not** hand-write SVG from a blank file (that's where corruption and misalignment come from).
- **Container:** page mode → build right inside `references/primitives.html` (it's both the scrolling house-style shell and the snippet library). Slides → `templates/slides.html`.
- **House style.** Dark canvas, single warm accent (`--acc #e06b3b`), mono labels. Keep it consistent run-to-run.
- **Text budget:** a title, ≤4 short labels, one caption line. If you're writing a sentence inside the drawing, cut it.
- **Self-contained.** Inline CSS/JS. CDN allowed only for Mermaid and rough.js (note the offline caveat); everything else inline. SVG diagrams and `animateMotion` need no dependency at all.

### Voice — raw facts, never buzzwords
Every word on screen (titles, labels, captions) is a plain fact, not copywriting. **Banned:** punchy two-part headlines ("Design calibrated. Blocked on one token."), marketing adjectives (calibrated, seamless, robust, unleash, blazing), invented jargon, rhetorical fragments. **Instead:** state the actual thing — "Blocked: missing API token in staging + prod". A title is the fact in plain words; a caption is concrete values, ideally short `key: value` fragments, not a flowing sentence. Lunch test: if you wouldn't say the phrase flatly to a teammate, cut it. This applies to page mode too, but slides tempt the marketing voice most — resist it.

### Slides mode — gazable, one diagram per slide (hard rules)
Slides fail by carrying prose. Enforce:
- **The diagram is the slide.** Each content slide is one drawing that *fully and correctly describes* that part of the architecture/flow — not a sketch of it with the real detail in text. If the diagram is incomplete, fix the diagram, don't add sentences.
- **≤3 short lines of text per slide**, ever. A 3–5 word title + at most one caption line + node labels. **No bullet lists of prose, no paragraphs.** If a slide needs explaining in sentences, it needs a better diagram.
- **Gazable in ~2 seconds.** A reader should grasp the slide's point at a glance, then read labels for detail.
- **Open on the core fast.** Lead with the architecture / the decision — at most one short title slide of ramp-up. Don't spend slides on context, motivation, or agenda.
- **One beat per slide**, composition varied slide-to-slide.

## Phase 3 — SHIP & VERIFY

```bash
mkdir -p /tmp/visualize
# write to /tmp/visualize/<slug>.html   (slug = short kebab of the topic)
open /tmp/visualize/<slug>.html        # macOS; use xdg-open on Linux
```

**Open it and confirm it actually rendered** — a diagram that 404s its CDN, an SVG that collapsed, or a slider wired to nothing is a broken visual. Then give the user the one-takeaway + the beat→drawing list in two or three chat lines, and the file path. The HTML is ephemeral scratch; ask before keeping or moving one.

## Attaching slides to a GitHub PR

Good default for PRs opened in autonomy mode or any "I want to come back to a ready PR" handoff: build a slide deck for the change, then attach **1–4 highest-value slides** as screenshots. The PR description *prose* stays plain markdown — the slides are added images, not a replacement.

1. **Shoot headless:** run the bundled script from the repo root (it resolves Playwright from the repo's `node_modules` via cwd, so it works in place): `node <skill-dir>/scripts/shoot-slides.mjs <deck.html> <outDir> [--slides=0,2,3]`. Captures each slide trimmed to content (chrome hidden, padding collapsed). If Playwright isn't installed in the repo: `npm i -D playwright`.
2. **Pick 1–4, ruthlessly.** The architecture diagram and the core decision usually earn it; ramp/title slides usually don't. More than 4 and reviewers skim past them.
3. **Interactive slides photograph badly.** A toggle-gated flow or slider is dead in a PNG. For one you still want to include, either:
   - capture the **key states** as separate frames (`--eval='document.querySelector("#g_auth").checked=false;document.querySelector("#g_auth").dispatchEvent(new Event("change"))' --tag=noauth`) and attach them as a short before/after pair, **and**
   - make sure the slide carries an on-image label saying what the control does (e.g. "toggle: authenticated") so the static frame is self-explanatory — a frozen control with no caption is noise.
   - When in doubt, prefer a static schematic of the same idea over a frozen interactive one.
4. **Attach with `gh-img`:** `gh img --repo <owner/repo> <outDir>/slide-*.png`, then embed the returned `![](url)` lines in the PR description (or as a comment). Never commit the PNGs into the diff. (See the repo README for `gh-img` setup.)

## Scope — where prose stays markdown

PR description *text*, commit messages, notes/journal files, code comments, and GitHub issue bodies stay plain markdown — don't render those as HTML. (Rendered slide *images* on a PR are fine, per the section above.) Otherwise this skill is for *explaining in the conversation*.
