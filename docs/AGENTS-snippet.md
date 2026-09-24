# Snippet for your agent instructions

Paste this into your agent's standing-instructions file — `~/.claude/CLAUDE.md` for Claude Code, `AGENTS.md`, a Cursor rule, whatever your harness reads. It tells the agent which of the two skills to reach for and how to put the result in a PR. Trim to taste.

---

## Explain visually — drawings over markdown

For plans, design decisions, option comparisons, architecture walkthroughs, bug root-causes, and any non-trivial concept explanation, draw the answer instead of writing a wall of markdown. A colored card, a table, or styled text is **not** a visual; draw the actual shape. The work is in the *information design*: what to show, in what form, and what to cut.

- **Interactive plans and explainers → `visualize`.** A self-contained HTML deck or page you open in the browser: schematic diagrams, animated flows, sliders and toggles the user can poke, sketches, themed Mermaid. Use a scrolling page only for dense reference.
- **PR slide stories and bug root-causes → `pixelviz`.** A short deck of 1920x1080 hand-inked slides (paper for the story, blueprint for the mechanism) that animate in steps of at most 3 s and end on a settled poster that tells the whole story alone.

Prose destinations stay markdown — PR description *text*, commit messages, notes, code comments.

## Attaching slides to a PR

When opening a PR, build a `pixelviz` deck for the change and capture it:

```
node ~/.claude/skills/pixelviz/scripts/capture.mjs deck.html shots/ --gif
```

It lints and renders every slide and writes `scene-NN.png` posters, `scene-NN.gif` per animated slide (a few MB, grain-free), `sheet.png` (a contact sheet to check by eye before shipping) and `deck.mp4`. Embed the GIF of the slide that carries the core decision, since it autoplays inline (its poster if that slide is a still; up to three more for distinct states), and attach `deck.mp4` below it for the full story. Upload by dragging the files into the PR description, or from the terminal with [`gh-img`](https://github.com/theolundqvist/gh-img):

```
gh img --repo <owner/repo> shots/scene-00.gif shots/deck.mp4   # prints lines to paste
```

Put the MP4's URL on a line of its own (without the `![]()` wrapper) so GitHub shows a player.

Keep decks and captures out of the commit. The PR description prose stays plain markdown; slides are added images.

**Tools this relies on (installed once):**
- **pixelviz capture** — `~/.claude/skills/pixelviz/scripts/capture.mjs`; needs `npm i` in that skill folder and `ffmpeg`
- **visualize screenshots** — `~/.claude/skills/visualize/scripts/shoot-slides.mjs` (for interactive decks: `--slides=1,3`)
- **gh-img** (optional) — https://github.com/theolundqvist/gh-img (`gh extension install theolundqvist/gh-img`)
