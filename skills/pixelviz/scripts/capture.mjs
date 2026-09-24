// Usage: node capture.mjs <deck.html> <outDir> [--scenes=0,2] [--gif] [--lint-only]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

async function loadChromium() {
  const bases = [path.join(process.cwd(), 'package.json'), fileURLToPath(new URL('../package.json', import.meta.url))];
  for (const base of bases) for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let entry;
    try { entry = createRequire(base).resolve(name); } catch { continue; }
    const mod = await import(pathToFileURL(entry).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return chromium;
  }
  throw new Error(`Playwright not found; run npm i in ${path.dirname(bases[1])}`);
}

const [htmlArg, outArg, ...rest] = process.argv.slice(2);
if (!htmlArg || !outArg) { console.error('usage: capture.mjs <deck.html> <outDir> [--scenes=0,2] [--gif] [--lint-only]'); process.exit(1); }
const opt = Object.fromEntries(rest.map(a => { const m = a.match(/^--([^=]+)=(.*)$/s); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true]; }));
const out = path.resolve(outArg);
await mkdir(out, { recursive: true });

const browser = await (await loadChromium()).launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(pathToFileURL(path.resolve(htmlArg)).href, { waitUntil: 'load' });
await page.evaluate(() => window.pixelviz.ready.then(() => true));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }

const count = await page.evaluate(() => window.pixelviz.count());
const pick = opt.scenes ? String(opt.scenes).split(',').map(Number) : [...Array(count).keys()];
const png = url => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const frame = (i, t, grain = true) => page.evaluate(([i, t, grain]) => window.pixelviz.frame(i, t, grain), [i, t, grain]);
const sha = url => createHash('sha256').update(url).digest('hex');
const issues = new Map(), hashes = [], sheet = [], clips = [];
let failed = false;

for (const i of pick) {
  const { title, duration, poster, fps, steps } = await page.evaluate(i => window.pixelviz.info(i), i);
  const n = String(i).padStart(2, '0');
  const frames = duration ? Math.round(duration * fps) : 1;
  const ts = duration ? [...Array(frames + 1).keys()].map(f => f / frames) : [poster];
  for (const t of ts) {
    let found;
    try { found = await page.evaluate(([i, t]) => window.pixelviz.lint(i, t), [i, t]); }
    catch (e) { found = [e.message.split('\n')[0].replace(/^page\.evaluate: Error: /, '')]; }
    for (const m of found) { const key = `${n} ${m.replace(/\d+(\.\d+)?/g, '#')}`; if (!issues.has(key)) issues.set(key, [m, t]); }
  }
  const starts = [0, ...steps];
  const mids = duration ? steps.map((s, j) => +((starts[j] + s) / 2).toFixed(4)) : [];
  for (const t of [poster, ...mids.slice(0, 1)]) hashes.push([i, t, sha(await frame(i, t))]);
  sheet.push([i, poster, `${n} ${title} · poster`]);
  if (duration) for (const [j, s] of steps.entries()) {
    sheet.push([i, mids[j], `${n} · step ${j + 1} mid · t=${mids[j].toFixed(2)}`]);
    if (s !== poster) sheet.push([i, s, `${n} · step ${j + 1} stop · t=${s.toFixed(2)}`]);
  }
  if (opt['lint-only']) continue;
  await writeFile(path.join(out, `scene-${n}.png`), png(await frame(i, poster)));
  if (duration) {
    const video = ts.flatMap(t => steps.includes(t) || steps.some(s => t < s && t + 1 / frames > s) ? Array(fps).fill(t) : [t]);
    const dir = path.join(out, `.frames-${n}`);
    const writeFrames = async grain => {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      let prev, buf;
      for (const [f, t] of video.entries()) {
        if (t !== prev) { buf = png(await frame(i, t, grain)); prev = t; }
        await writeFile(path.join(dir, `f${String(f).padStart(4, '0')}.png`), buf);
      }
    };
    const seq = path.join(dir, 'f%04d.png');
    await writeFrames(true);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', seq, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', path.join(out, `scene-${n}.mp4`)]);
    if (opt.gif) {
      // The film grain changes every pixel on every frame, which defeats GIF frame diffing (21 MB vs 5 MB per slide).
      await writeFrames(false);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', seq, '-vf',
        'scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle', path.join(out, `scene-${n}.gif`)]);
    }
    await rm(dir, { recursive: true });
  } else execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(fps), '-t', '3', '-i', path.join(out, `scene-${n}.png`),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', path.join(out, `scene-${n}.mp4`)]);
  clips.push(path.join(out, `scene-${n}.mp4`));
  console.log(`scene ${n} ${title}: ${duration ? `${frames} frames` : 'still'}`);
}

for (const [i, t, h] of [...hashes].reverse()) {
  if (sha(await frame(i, t)) !== h) { console.error(`DETERMINISM ${String(i).padStart(2, '0')} frame at t=${t} differs when rendered again in another order`); failed = true; }
}

if (!opt['lint-only']) {
  const cols = 3, tw = 640, th = 360, lh = 40, gap = 12;
  await page.evaluate(([cols, tw, th, lh, gap, rows]) => {
    const c = document.createElement('canvas');
    c.width = cols * (tw + gap) + gap; c.height = rows * (th + lh + gap) + gap;
    const g = c.getContext('2d'); g.fillStyle = '#15120e'; g.fillRect(0, 0, c.width, c.height);
    window.__sheet = c;
  }, [cols, tw, th, lh, gap, Math.ceil(sheet.length / cols)]);
  for (const [k, [i, t, label]] of sheet.entries()) await page.evaluate(([i, t, label, k, cols, tw, th, lh, gap]) => {
    window.pixelviz.frame(i, t);
    const g = window.__sheet.getContext('2d'), x = gap + (k % cols) * (tw + gap), y = gap + Math.floor(k / cols) * (th + lh + gap);
    g.imageSmoothingQuality = 'high';
    g.drawImage(document.getElementById('out'), x, y, tw, th);
    g.fillStyle = '#efe3c9'; g.font = '600 22px Inter, system-ui, sans-serif'; g.textBaseline = 'top';
    g.fillText(label, x + 4, y + th + 9, tw - 8);
  }, [i, t, label, k, cols, tw, th, lh, gap]);
  await writeFile(path.join(out, 'sheet.png'), png(await page.evaluate(() => window.__sheet.toDataURL('image/png'))));
}
await browser.close();

if (clips.length > 1) {
  const list = path.join(out, '.deck.txt');
  await writeFile(list, clips.map(c => `file '${c}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'deck.mp4')]);
  await rm(list);
}

for (const [key, [m, t]] of issues) { console.error(`LINT ${key.slice(0, 2)} ${m} (first at t=${t.toFixed(3)})`); failed = true; }
process.exit(failed ? 1 : 0);
