// Reusable slide-design workflow: Ground -> Shape -> Design -> Assemble.
// The multi-agent, scaled version of the `visualize` skill — reach for it when a deck
// has many slides or the architecture is unfamiliar. The inline skill (SKILL.md) is the
// single-agent version of the same discipline: ground in code, decide the shape, then
// iterate every slide against its own rendered PNG.
//
// Run with the Workflow tool: { scriptPath: ".../skills/visualize/workflows/design-slides.workflow.js" }
// Iterate by editing the CONFIG block below, then re-invoke with the same scriptPath.
// Pass overrides via the tool's `args` (an object with the same shape as DEFAULT_CONFIG).
// Requires a harness with a multi-agent Workflow runner (agent/parallel/pipeline/phase).

export const meta = {
  name: 'design-slides',
  description: 'Research-grounded slide design: ground each slide from code (file:line proof), argue the visual shape, then iterate one designer per slide against the rendered PNG until it lines up',
  phases: [
    { title: 'Ground', detail: 'derive each slide concept from code with file:line proof' },
    { title: 'Shape', detail: '3 proposers + synth pick the visual composition per slide' },
    { title: 'Design', detail: 'one designer per slide iterates HTML -> shoot -> view PNG -> fix' },
    { title: 'Assemble', detail: 'merge kept slides with the new slides, shoot every slide' },
  ],
}

// ============================ CONFIG — EDIT PER DECK ============================
// `args` (passed to the Workflow tool) overrides this whole block when provided.
// All paths are absolute (the workflow sandbox has no env/HOME expansion).
const DEFAULT_CONFIG = {
  // cwd for code research AND for shooting (Playwright resolves from repo node_modules via cwd).
  repo: '/absolute/path/to/your/repo',
  // Existing deck that defines the house style; also the source of any kept slides.
  // A fresh deck from templates/slides.html works as the style reference too.
  styleDeck: '/absolute/path/to/style-deck.html',
  // Titles of slides in styleDeck to keep VERBATIM, in order. [] = start fresh.
  keepSlideTitles: [],
  outRoot: '/tmp/visualize/slides',
  finalDeck: '/tmp/visualize/slides-final.html',
  // The bundled headless screenshot script (adjust to where the skill is installed).
  shoot: '/absolute/path/to/.claude/skills/visualize/scripts/shoot-slides.mjs',
  // One entry per NEW slide. `brief` is a research prompt — anchor it to file:line.
  slides: [
    {
      key: 'example',
      brief: 'SLIDE — "<title>". Research <paths> in the repo. Answer with file:line proof: <the concrete question>. The slide must show <the one beat>. Do NOT show <the trap>.',
    },
  ],
}
const CONFIG = typeof args === 'object' && args && Array.isArray(args.slides) ? args : DEFAULT_CONFIG
const SLIDES = CONFIG.slides.map((s, i) => ({ ...s, outDir: `${CONFIG.outRoot}/${s.key || i}` }))
// ===============================================================================

const STYLE = `HOUSE STYLE — match the existing deck EXACTLY. Read ${CONFIG.styleDeck}: its <head>/<style> shell and existing slides are the gold reference. New slides must look like they belong in that same deck.
Tokens: --bg #0d1117; panels #141b24/#161f2b/#10151c; --line #2a313c; ink #e6edf3; --mut #9aa7b4; --dim #6b7785. Color carries role, not decoration: single warm accent --acc #e06b3b / --acc2 #f0a868 = the primary subject + primary edges; teal #3a8f82 or blue #4493f8 = secondary systems; purple #a371f7 = external services; slate/muted = stores.
A slide is exactly: <section class="slide"><h2 class="title">SHORT</h2><div class="figure"><svg viewBox="0 0 W H" width="W">...</svg></div><p class="cap">one line</p></section>.
Diagram = hand-authored SVG: rounded <rect> boxes, your own <marker> arrowheads (ids prefixed per slide, e.g. s3arr, so slides don't collide), edge labels over a small filled bg <rect> so they read over lines. Size the viewBox so NOTHING overlaps and nothing is clipped.
VOICE: plain facts, short labels, ONE caption line. No marketing words, no sentences inside the figure. Graspable in ~2 seconds.`

const GROUND_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    takeaway: { type: 'string', description: 'the single sentence the slide must land' },
    title: { type: 'string', description: 'a short 3-6 word slide title' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          sub: { type: 'string', description: 'one short sub-line, may be empty' },
          role: { type: 'string', enum: ['client', 'backend', 'sandbox', 'external', 'store', 'code', 'artifact'] },
        },
        required: ['id', 'label', 'sub', 'role'],
      },
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          label: { type: 'string' },
          kind: { type: 'string', enum: ['primary', 'secondary', 'return'] },
        },
        required: ['from', 'to', 'label', 'kind'],
      },
    },
    proof: { type: 'array', items: { type: 'string' }, description: 'file:line - what it shows, concrete' },
    traps: { type: 'array', items: { type: 'string' }, description: 'misconceptions the diagram must NOT show' },
  },
  required: ['takeaway', 'title', 'nodes', 'edges', 'proof', 'traps'],
}

const SHAPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    plan: { type: 'string', description: 'the chosen concrete spatial layout: bands/columns, where each node sits, how edges route, the viewBox. Detailed enough to draw without re-deciding composition.' },
    rationale: { type: 'string', description: 'why this composition lands the takeaway better than the alternatives' },
  },
  required: ['plan', 'rationale'],
}

const DESIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fragment: { type: 'string', description: 'the final <section class="slide">...</section> HTML fragment exactly as written in the file' },
    iterations: { type: 'number' },
    shotPath: { type: 'string', description: 'absolute path to the final PNG it rendered and viewed' },
    selfCritique: { type: 'string', description: 'what it verified in the final rendered image' },
  },
  required: ['fragment', 'iterations', 'shotPath', 'selfCritique'],
}

const ASSEMBLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    deckPath: { type: 'string' },
    shots: { type: 'array', items: { type: 'string' } },
    issues: { type: 'string', description: 'any visual problem still visible in the final render, or "none"' },
  },
  required: ['deckPath', 'shots', 'issues'],
}

// ---------- Phase 1: GROUND (parallel barrier) ----------
phase('Ground')
const grounded = await parallel(
  SLIDES.map((slide) => () =>
    agent(
      `${slide.brief}\n\nReturn the slide's concept as structured nodes + edges + file:line proof + traps. Be thorough and verify each claim against the actual code in ${CONFIG.repo} — wrong architecture is worse than a missing detail. Nodes are the boxes; edges are the arrows between them with short labels.`,
      { label: `ground:${slide.key}`, phase: 'Ground', agentType: 'general-purpose', schema: GROUND_SCHEMA }
    ).then((facts) => ({ ...slide, facts }))
  )
)
const ready = grounded.filter(Boolean)
log(`Grounded ${ready.length}/${SLIDES.length} slides from code`)

// ---------- Phase 2 + 3: SHAPE then DESIGN, pipelined per slide ----------
const designed = await pipeline(
  ready,
  // STAGE 1: SHAPE — 3 proposers argue from different lenses, 1 synth picks.
  async (slide) => {
    const factsJson = JSON.stringify(slide.facts, null, 2)
    const lenses = [
      'left-to-right pipeline (origin -> transform -> destination), bands per environment',
      'split/contrast layout — put the two contrasting kinds side by side sharing a common spine',
      'central code/artifact panel with annotated arrows fanning out to what it can reach',
    ]
    const proposals = await parallel(
      lenses.map((lens, i) => () =>
        agent(
          `You are composing the VISUAL SHAPE of one slide (not drawing it yet). Lens to argue from: ${lens}.\n\nGrounded facts:\n${factsJson}\n\n${STYLE}\n\nPropose the strongest composition from your lens: which nodes are bands vs boxes, their spatial arrangement, how edges route so none cross messily, and a rough viewBox. Argue why it lands the takeaway in 2 seconds. Be concrete about positions.`,
          { label: `shape:${slide.key}:${i}`, phase: 'Shape', agentType: 'general-purpose' }
        )
      )
    )
    const synth = await agent(
      `Reconcile these three composition proposals for the slide "${slide.facts.title}" into the SINGLE best layout. Take the strongest idea from each; reject anything that would overlap, crowd, or misrepresent the grounded facts.\n\nGrounded facts:\n${factsJson}\n\nProposals:\n${proposals.filter(Boolean).map((p, i) => `--- proposal ${i + 1} ---\n${p}`).join('\n\n')}\n\n${STYLE}\n\nOutput the chosen concrete spatial plan a designer can draw without re-deciding composition.`,
      { label: `shape-synth:${slide.key}`, phase: 'Shape', agentType: 'general-purpose', schema: SHAPE_SCHEMA }
    )
    return { ...slide, shape: synth }
  },
  // STAGE 2: DESIGN — one designer iterates against the rendered PNG.
  async (slide) => {
    if (!slide || !slide.shape) return null
    const factsJson = JSON.stringify(slide.facts, null, 2)
    return agent(
      `You are the sole designer for ONE slide. Draw it as hand-authored SVG matching the house deck, render it to a PNG, LOOK at the PNG, and iterate until it is visually perfect. Bar: zero overlapping shapes, nothing clipped at the viewBox edges, every arrow visibly touches the two boxes it connects, every label sits inside or clearly beside its element and is legible, and the drawing faithfully shows the grounded nodes + edges (and none of the traps).\n\n${STYLE}\n\nGROUNDED FACTS:\n${factsJson}\n\nCHOSEN LAYOUT (follow this composition):\n${slide.shape.plan}\n\nPROCEDURE — all from cwd ${CONFIG.repo}:\n1. Read ${CONFIG.styleDeck} to copy the EXACT <head>/<style> shell and closing nav <script>. Build ${slide.outDir}/deck.html = shell + <div class="deck"> + your ONE new <section class="slide">...</section> + closing nav script + </div></body></html>. (mkdir -p ${slide.outDir} first.)\n2. Render: run \`node ${CONFIG.shoot} ${slide.outDir}/deck.html ${slide.outDir}\` from the repo root. It writes slide-01.png.\n3. READ ${slide.outDir}/slide-01.png with the Read tool and critique it as if unseen: list every overlap, clip, floating/misconnected arrow, unreadable or mislabeled text, and any drift from the grounded facts.\n4. Edit the SVG to fix every issue, re-render, re-read. Repeat AT LEAST 3 times; stop only when the image is clean against the bar.\n5. Return the final <section>...</section> fragment exactly as in the file, the iteration count, the final PNG path, and your final self-critique.\n\nDraw only what the grounded facts support — do not invent boxes. Precision over decoration.`,
      { label: `design:${slide.key}`, phase: 'Design', agentType: 'claude', schema: DESIGN_SCHEMA }
    ).then((out) => ({ ...slide, design: out }))
  }
)

const finals = designed.filter((s) => s && s.design && s.design.fragment)
log(`Designed ${finals.length}/${ready.length} slides`)

// ---------- Phase 4: ASSEMBLE ----------
phase('Assemble')
const orderedFragments = SLIDES.map((cfg) => finals.find((s) => s.key === cfg.key))
  .filter(Boolean)
  .map((s) => s.design.fragment)

const keepClause = CONFIG.keepSlideTitles && CONFIG.keepSlideTitles.length
  ? `Keep these existing slides from ${CONFIG.styleDeck} VERBATIM, in order, as the first slides: ${CONFIG.keepSlideTitles.map((t) => `"${t}"`).join(', ')}. Drop every other existing slide.`
  : `Do not keep any existing slides.`

const assembled = await agent(
  `Assemble the final deck at ${CONFIG.finalDeck}. From cwd ${CONFIG.repo}.\n\n1. Read ${CONFIG.styleDeck}. Reuse its full <head>/<style> shell and its closing nav <script>. ${keepClause}\n2. Build ${CONFIG.finalDeck} = shell + <div class="deck"> + [kept slides in order] + [the new fragments below IN ORDER] + closing nav <script> + </div></body></html>.\n\n${orderedFragments.map((f, i) => `NEW FRAGMENT ${i + 1}:\n${f}`).join('\n\n')}\n\n3. Render all slides: \`node ${CONFIG.shoot} ${CONFIG.finalDeck} ${CONFIG.outRoot}/final\` from repo root.\n4. READ each PNG and confirm coherence: consistent house style across all slides, no clipping/overlap on the new slides, nav slide-count correct. Report the deck path, the PNG paths in order, and any remaining visual issue (or "none").`,
  { label: 'assemble', phase: 'Assemble', agentType: 'claude', schema: ASSEMBLE_SCHEMA }
)

return {
  deckPath: assembled?.deckPath,
  shots: assembled?.shots,
  issues: assembled?.issues,
  grounding: ready.map((s) => ({ key: s.key, title: s.facts.title, proof: s.facts.proof, traps: s.facts.traps })),
  iterations: finals.map((s) => ({ key: s.key, iterations: s.design.iterations, selfCritique: s.design.selfCritique })),
}
