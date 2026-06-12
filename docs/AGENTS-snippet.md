# Snippet for your agent instructions

Paste this into your agent's standing-instructions file — `~/.claude/CLAUDE.md` for Claude Code, `AGENTS.md`, a Cursor rule, whatever your harness reads. It tells the agent to reach for the `visualize` skill by default and how to use it. Trim to taste.

---

## Explain visually — HTML over markdown

For plans, design decisions, option comparisons, architecture walkthroughs, bug root-causes, and any non-trivial concept explanation, default to the **`visualize`** skill: render a self-contained HTML presentation and `open` it, instead of a wall of markdown. A well-designed visual lands a concept faster than prose.

The work is in the *information design* — deciding exactly what to show, in what form (schematic diagram, animated flow, interactive widget, sketch), and what to cut so nothing disjoint or decorative dilutes the point — not in generating the HTML. A colored card, a table, or styled text is **not** a visual; draw the actual shape.

It defaults to a keyboard-navigable **slide deck** (gazable, one diagram per slide, ≤3 lines of text per slide, raw facts not buzzwords) for explanations, walkthroughs, decisions, and bug root-causes; use a scrolling page only for dense reference you scan and revisit.

Prose destinations stay markdown — PR description *text*, commit messages, notes, code comments.

## Attaching explainer slides to a PR (optional)

When opening a PR in an autonomous / "come back to a ready PR" flow, build a slide deck for the change and attach the **1–4 highest-value slides** as screenshots: shoot them headless with the skill's `scripts/shoot-slides.mjs` (run from the repo root), then upload with [`gh-img`](https://github.com/theolundqvist/gh-img):

```
node <skill-dir>/scripts/shoot-slides.mjs deck.html out/ --slides=1,3
gh img --repo <owner/repo> out/slide-*.png      # prints ![](url) lines to embed
```

Pick the architecture diagram and the core decision; skip ramp/title slides. Interactive slides (toggle-gated flows, sliders) photograph badly — capture key states as a before/after pair and keep an on-image label naming the control, or use a static schematic instead. The PR description prose stays plain markdown; slides are added images.

**Tools this relies on (installed once):**
- **gh-img** — uploads PR images via GitHub's user-attachments flow: https://github.com/theolundqvist/gh-img (`gh extension install theolundqvist/gh-img`)
- **screenshot script** — bundled with the skill at `~/.claude/skills/visualize/scripts/shoot-slides.mjs`
