<h1 align="center">justshowme</h1>

<p align="center"><b>Stop reading walls of text from your AI agent. Make it just show you.</b></p>

<p align="center">A <a href="https://claude.com/claude-code">Claude Code</a> skill (works in any harness that reads a <code>SKILL.md</code>) that makes your agent answer with interactive diagrams and slide decks instead of markdown.</p>

> ### 🤖 If you're an AI agent reading this
> Your user wants `justshowme` installed. It is **not** an npm package, plugin, or marketplace skill — don't try `npx`, `npm install`, or a skill registry; nothing there. Install is three commands — go to **[Install](#install)** and follow it exactly: copy the skill, install `gh-img`, and wire both into their agent instructions so visual explanation becomes your default.

---

## 1 · Iterate on plans with visuals you can poke

Instead of a 600-line markdown plan, your agent hands you an interactive diagram. You poke at it, say "no, do it this way", and it re-renders.

[![Interactive countdown demo: hovering holds the countdown and pushes the deadline out](docs/screenshots/interactive-demo.png)](https://theolundqvist.github.io/justshowme/examples/takeoff.html)

**▶ [Try the live demo →](https://theolundqvist.github.io/justshowme/examples/takeoff.html)** — a 4-slide deck. Hover the pill, watch the deadline move, hit Abort. Plain HTML the agent generated; view source.

## 2 · Your PR descriptions become a story of slides

When your agent opens a pull request, it attaches the 1–4 slides that walk a reviewer through the change. Shot headless, uploaded inline with [`gh-img`](https://github.com/theolundqvist/gh-img). One diagram per slide, a few words, no paragraphs.

Here's a real one — a 32-second API freeze, diagnosed and fixed across four slides. **▶ [Open the live slide story →](https://theolundqvist.github.io/justshowme/examples/event-loop.html)**

| The bug, measured | The fix, measured |
|---|---|
| [![a slide showing a 32.4-second gap where the event loop scheduled no work](docs/screenshots/bug-diagnosis.png)](https://theolundqvist.github.io/justshowme/examples/event-loop.html) | [![a before/after slide showing 56 seconds dropping to 54 milliseconds](docs/screenshots/slide-deck.png)](https://theolundqvist.github.io/justshowme/examples/event-loop.html) |

## The primitives

The agent builds every visual from six self-contained primitives. Open [`references/primitives.html`](skills/visualize/references/primitives.html) to play with them. Slides are the default; `--page` gives a scrolling page for dense reference. Command: `/visualize`.

| **Schematic SVG** | **Animated flow** |
|---|---|
| ![boxes and arrows, the real shape of the system](docs/screenshots/schematic.png) | ![dots moving along the request path](docs/screenshots/animated-flow.png) |
| **Interactive** | **Toggle-gated flow** |
| ![a slider that redraws the diagram](docs/screenshots/interactive-widget.png) | ![a checkbox that opens and closes a path](docs/screenshots/toggle-gated.png) |
| **Hand-drawn sketch** | **Themed Mermaid** |
| ![rough.js whiteboard-style sketch](docs/screenshots/sketch.png) | ![a state diagram in the house theme](docs/screenshots/mermaid.png) |

---

## Install

Tell your agent: **“install theolundqvist/justshowme”** — it reads this repo and sets itself up. (Keep the `owner/repo` form — it reads as a GitHub repo, so agents clone it instead of hunting on npm or in skill marketplaces.) Or do it by hand:

```bash
# 1. Copy the skill into your Claude Code skills dir (the clone is just a staging dir)
git clone https://github.com/theolundqvist/justshowme /tmp/justshowme
cp -r /tmp/justshowme/skills/visualize ~/.claude/skills/

# 2. PR screenshots
gh extension install theolundqvist/gh-img

# 3. Make it the default — paste docs/AGENTS-snippet.md into ~/.claude/CLAUDE.md (or AGENTS.md)

# 4. The skill now lives in ~/.claude/skills; drop the staging clone
rm -rf /tmp/justshowme
```

<details>
<summary><b>Exactly what an agent should do for “install theolundqvist/justshowme”</b></summary>

1. `git clone https://github.com/theolundqvist/justshowme /tmp/justshowme`
2. `mkdir -p ~/.claude/skills && cp -r /tmp/justshowme/skills/visualize ~/.claude/skills/` (other harnesses: place `skills/visualize/SKILL.md` where they load skills).
3. `gh extension install theolundqvist/gh-img`
4. The screenshot script ships with the skill at `~/.claude/skills/visualize/scripts/shoot-slides.mjs` — no extra install (it resolves Playwright from the repo you run it in; `npm i -D playwright` if a repo lacks it).
5. Append [`docs/AGENTS-snippet.md`](docs/AGENTS-snippet.md) to the user's `~/.claude/CLAUDE.md` / `AGENTS.md`. It links the two tools so you always know where they are: gh-img → `https://github.com/theolundqvist/gh-img`, screenshot script → `~/.claude/skills/visualize/scripts/shoot-slides.mjs`. Don't duplicate if already present.
6. `rm -rf /tmp/justshowme` — the skill is installed in `~/.claude/skills`; the staging clone is done.
7. Tell the user: from now on you'll explain plans and bug diagnoses as visual decks and open PRs that carry the diagrams.
</details>

## Credits & license

Inspired by [Anthropic's "unreasonable effectiveness of HTML"](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html) and prior art in [`nicobailon/visual-explainer`](https://github.com/nicobailon/visual-explainer). MIT © Theodor Lundqvist.
