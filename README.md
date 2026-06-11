# claude-viz

**Turn an AI agent's explanations into gazable visuals — diagrams, animated flows, and interactive widgets — instead of walls of markdown.**

`claude-viz` is a [Claude Code](https://claude.com/claude-code) skill (it works in any agent harness that reads a `SKILL.md`) that makes your agent *draw* a concept rather than describe it: a schematic when you ask how something fits together, an animated flow for a pipeline, a toggle-gated diagram for "what does this flag actually change", a keyboard-navigable slide deck for a design walkthrough. Self-contained HTML, opens in your browser, zero build step.

## Why

Markdown is great until the explanation gets real. Past ~100 lines it's a wall you skim and forget. As [Anthropic's own engineers have argued](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html), HTML conveys far more — tables, SVG, color, interaction, spatial layout — and keeps you *in the loop* with what the agent is doing. If you're a visual learner, a diagram lands a system in two seconds that three paragraphs never will.

The catch: most "AI visuals" are just colored cards and styled text in a box — still reading, not seeing. `claude-viz` is opinionated that **a card or a table is not a visual.** A visual is a shape you understand by looking: boxes and arrows with real spatial meaning, dots moving through a pipeline, a slider that moves a curve. The skill puts the effort into the *information design* — what to show, in what form, and what to cut — and starts every drawing from a proven primitive so it comes out clean.

## What's in the box

| Piece | What it does |
|---|---|
| **`skills/visualize/SKILL.md`** | The skill: plan-first workflow, mode selection, the house rules (draw don't tell, raw facts not buzzwords, gazable slides). |
| **`references/primitives.html`** | A working kit you copy from — schematic SVG, animated flow, slider-interactive, **toggle-gated flow**, hand-drawn sketch (rough.js), and themed Mermaid. Open it in a browser to see them all live. |
| **`templates/slides.html`** | A keyboard/scroll/swipe-navigable slide deck (progress bar, dots, counter) — dependency-free. |
| **`scripts/shoot-slides.mjs`** | Headless per-slide screenshots, trimmed to content, for attaching to PRs. |
| **`docs/AGENTS-snippet.md`** | The block to paste into your agent's standing instructions so it reaches for this by default. |

## Install

**1. Drop the skill into your harness.** For Claude Code:

```bash
git clone https://github.com/theolundqvist/claude-viz
cp -r claude-viz/skills/visualize ~/.claude/skills/
```

(or symlink it). Other harnesses: point them at `skills/visualize/SKILL.md`.

**2. Make it a default.** Paste [`docs/AGENTS-snippet.md`](docs/AGENTS-snippet.md) into your `~/.claude/CLAUDE.md` / `AGENTS.md` / Cursor rule.

**3. (Optional) PR screenshots.** To attach slides to pull requests you need two tools:
- [`gh-img`](https://github.com/theolundqvist/gh-img) — uploads images via GitHub's `user-attachments` flow so they render inline and inherit repo visibility: `gh extension install theolundqvist/gh-img`
- Playwright, in whatever repo you're shooting from: `npm i -D playwright && npx playwright install chromium`

## Use

```
/visualize how the auth middleware gates requests        # → a slide deck (the default)
/visualize --page the component primitives reference      # → a scrolling page (for dense reference)
```

Slides are the default — gazable, one diagram per slide, ≤3 lines of text, raw facts not buzzwords. A scrolling **page** is for reference you scan and revisit (a component library, a big matrix).

### Attaching slides to a PR

```bash
node ~/.claude/skills/visualize/scripts/shoot-slides.mjs deck.html out/ --slides=1,3
gh img --repo owner/repo out/slide-*.png      # prints ![](url) lines to paste into the PR
```

Pick the 1–4 highest-value slides (architecture + the core decision). Interactive slides die as static PNGs — capture key states as a before/after pair with `--eval`/`--tag`, or use a static schematic.

## The house rules (why the output looks the way it does)

- **Draw, don't tell.** A card/table/styled-text is not a visual. Every beat becomes a diagram, flow, interactive, or sketch — or it's a one-line caption, or it's cut.
- **Plan first.** The effort is in choosing what to show and in what form; generating the HTML is mechanical. Start from a working primitive, never freehand SVG.
- **Raw facts, never buzzwords.** Titles and labels state the actual thing. No "Design calibrated. Blocked on one token." copywriting.
- **Gazable slides.** One diagram per slide that *fully* describes that part of the flow, ≤3 short lines of text, graspable in ~2 seconds. Lead with the core fast.
- **Cull to the takeaway.** Every mark on the canvas traces to the one thing the reader should leave with. No decorative SVG.

## Credits

Inspired by [Anthropic's "unreasonable effectiveness of HTML"](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html) and the prior art in [`nicobailon/visual-explainer`](https://github.com/nicobailon/visual-explainer). The slide-deck nav started from visual-explainer's engine and was rewritten dependency-free.

## License

MIT © Theodor Lundqvist
