// Headless per-slide screenshots of a `visualize` slide deck, for attaching to a PR.
// Captures each slide trimmed to its content — nav chrome (progress bar, dots, counter, hint) hidden
// and the 100vh centering collapsed — so the content fills the PR image instead of floating in padding.
//
// Run it IN PLACE from the repo root (do NOT copy it into the repo): the script resolves Playwright
// from the current working directory's node_modules, so any repo that has playwright / @playwright/test
// installed works. If none is installed: `npm i -D playwright` (or run from a repo that already has it).
//
// Usage: node path/to/shoot-slides.mjs <deck.html> <outDir> [--slides=0,2,3] [--eval='<js>'] [--tag=label]
//   --slides  0-based indices to capture (default: all)
//   --eval    JS run once after load, before capture — set an interactive state (toggle a checkbox, etc.)
//   --tag     filename suffix, e.g. --tag=noauth → slide-03-noauth.png  (use to capture 2 states of one slide)
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Resolve Playwright from the repo being worked in (cwd), not from this script's path.
async function loadChromium() {
  const req = createRequire(path.join(process.cwd(), 'package.json')); // base file need not exist
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let entry;
    try { entry = req.resolve(name); } catch { continue; }
    const mod = await import(pathToFileURL(entry).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return chromium;
  }
  throw new Error('Playwright not found from ' + process.cwd() + ' — run from a repo with playwright installed, or `npm i -D playwright`.');
}

const [htmlArg, outArg, ...rest] = process.argv.slice(2);
if (!htmlArg || !outArg) { console.error('usage: shoot-slides.mjs <deck.html> <outDir> [--slides=0,2] [--eval=js] [--tag=label]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)=(.*)$/s); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));

const out = path.resolve(outArg);
await mkdir(out, { recursive: true });

const chromium = await loadChromium();
let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ channel: 'chrome' }); } // fall back to system Chrome if no bundled browser

const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(path.resolve(htmlArg)).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);                 // fonts, Mermaid render, first paint

// Capture mode: drop nav chrome and the full-viewport centering so each frame hugs its content.
await page.addStyleTag({ content: `
  .deck-progress,.deck-dots,.deck-counter,.deck-hints{display:none!important}
  .slide{min-height:auto!important;width:fit-content!important;max-width:1200px!important;
         margin:0 auto!important;padding:40px 52px!important;opacity:1!important;transform:none!important}
` });

if (opt.eval) { await page.evaluate(opt.eval); await page.waitForTimeout(400); }

const slides = await page.$$('.slide');
const want = opt.slides ? String(opt.slides).split(',').map(Number) : slides.map((_, i) => i);
const tag = opt.tag ? `-${opt.tag}` : '';
for (const i of want) {
  const el = slides[i];
  if (!el) { console.error(`no slide at index ${i}`); continue; }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);               // reveal transition + an animation frame
  const f = path.join(out, `slide-${String(i + 1).padStart(2, '0')}${tag}.png`);
  await el.screenshot({ path: f });
  console.log(f);
}
await browser.close();
