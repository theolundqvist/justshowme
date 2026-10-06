#!/usr/bin/env node
// check.mjs <dir> [name…] [--frames 120,480]: lint every composition at its cue frames and write a contact sheet.
// Rules, in 1920×1080 units: LABEL (data-role="label") under 40 px, TEXT under 30 px, CROP (text or panel past the frame edge while the camera is still),
// OVERLAP (two texts on top of each other); sizes and crops are judged only once the camera has settled, SPARSE (under 4% of the frame carries anything). Exits 1 on any finding.
import * as esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { buildOptions, comps, serve, writeEntry } from "./dev.mjs";

const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const only = args.filter((a, i) => !a.startsWith("--") && i > 0 && args[i - 1] !== "--frames");
const extra = args.includes("--frames") ? args[args.indexOf("--frames") + 1].split(",").map(Number) : [];
const gen = writeEntry(dir);

await esbuild.build(buildOptions(dir, join(gen, "entry.tsx"), join(gen, "app.js")));
const server = serve(dir, 0);
await new Promise((ok) => server.once("listening", ok));
const { port } = server.address();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on("pageerror", (e) => console.error("page error:", e.message));

const lint = () => {
  const svg = document.querySelector("svg[data-stage]");
  const box = svg.getBoundingClientRect();
  const k = 1920 / box.width;
  const vis = (el) => {
    let o = 1;
    for (let e = el; e && e !== svg; e = e.parentElement) o *= +getComputedStyle(e).opacity;
    return o;
  };
  const under = (el, sel) => !!el.parentElement?.closest(sel);
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - box.left) * k, y: (r.top - box.top) * k, w: r.width * k, h: r.height * k };
  };
  const out = [];
  const texts = [];
  for (const t of svg.querySelectorAll("text")) {
    if (!t.textContent.trim() || vis(t) < 0.15) continue;
    const moving = under(t, "[data-moving]");
    const m = t.getScreenCTM();
    const px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b) * k;
    const r = rect(t);
    const s = t.textContent.trim().slice(0, 28);
    const label = t.dataset.role === "label";
    if (moving) {
      texts.push({ r: rect(t), s: t.textContent.trim().slice(0, 28) });
      continue;
    }
    if (label && px < 39.5) out.push(`LABEL ${px.toFixed(0)}px "${s}"`);
    else if (px < 29.5) out.push(`TEXT ${px.toFixed(0)}px "${s}"`);
    texts.push({ r, s });
  }
  // Inside a framed Screenshot the frame is the edge that crops; a callout cut by it is as broken as one cut by the video edge.
  const edge = (e) => {
    const g = e.parentElement?.closest("[clip-path]");
    const cr = g?.previousElementSibling?.hasAttribute("data-cliprect") ? rect(g.previousElementSibling) : null;
    return cr ?? (g ? null : { x: 0, y: 0, w: 1920, h: 1080 });
  };
  const still = (e) => !under(e, "[data-moving]") && !under(e, "mask, clipPath, pattern") && vis(e) >= 0.15;
  const marks = [...svg.querySelectorAll("text, [data-kind=mark]")].filter(still);
  const panels = [...svg.querySelectorAll("rect")].filter((e) => still(e) && !under(e, "[clip-path]"));
  for (const e of [...marks, ...panels]) {
    const r = rect(e);
    if (e.tagName === "rect" && (r.w < 60 || r.h < 60 || r.w >= 1900 || r.h >= 1060)) continue;
    const f = edge(e);
    if (!f) continue;
    const o = Math.max(f.x - r.x, f.y - r.y, r.x + r.w - (f.x + f.w), r.y + r.h - (f.y + f.h));
    if (o > 3) out.push(`CROP ${o.toFixed(0)}px ${e.tagName}${e.tagName === "text" ? ` "${e.textContent.trim().slice(0, 28)}"` : ""}`);
  }
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].r, b = texts[j].r;
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix > 0 && iy > 0 && ix * iy > 0.2 * Math.min(a.w * a.h, b.w * b.h)) out.push(`OVERLAP "${texts[i].s}" / "${texts[j].s}"`);
    }
  return [...new Set(out)];
};

const ink = (b64) =>
  new Promise((ok) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = 192, c.height = 108;
      const g = c.getContext("2d");
      g.drawImage(im, 0, 0, 192, 108);
      const d = g.getImageData(0, 0, 192, 108).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) > 70) n++;
      ok(n / (192 * 108));
    };
    im.src = "data:image/png;base64," + b64;
  });

let bad = 0;
const shots = [];
rmSync(join(gen, "check"), { recursive: true, force: true });
mkdirSync(join(gen, "check"), { recursive: true });
for (const name of comps(dir).map((f) => f.replace(/\.tsx$/, "")).filter((n) => !only.length || only.includes(n))) {
  await page.goto(`http://localhost:${port}/?lint=${name}`);
  await page.waitForFunction(() => window.__mv && document.querySelector("svg[data-stage]"), null, { timeout: 30000 });
  const info = await page.evaluate((n) => window.__mv.comps.find((c) => c.name === n), name);
  const frames = [...new Set([...info.checks, ...extra])].filter((f) => f < info.frames).sort((a, b) => a - b);
  console.log(`${name}: ${info.kind}, ${info.frames} frames at ${info.fps} fps, checking ${frames.length} cue frames`);
  for (const f of frames) {
    await page.evaluate(([n, fr]) => window.__mv.seek(n, fr), [name, f]);
    const file = join(gen, "check", `${name}-${String(f).padStart(5, "0")}.png`);
    const png = await page.screenshot({ path: file });
    const found = await page.evaluate(lint);
    const fill = await page.evaluate(ink, png.toString("base64"));
    if (fill < 0.04) found.push(`SPARSE ${(fill * 100).toFixed(1)}% ink`);
    shots.push(file);
    const t = (f / info.fps).toFixed(1).padStart(5);
    console.log(`  ${String(f).padStart(5)} ${t}s  ${found.length ? found.join(" · ") : "ok"}`);
    bad += found.length;
  }
}
await browser.close();
server.close();
if (shots.length) {
  const cols = 4;
  const sheet = join(gen, "check", "sheet.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-pattern_type", "glob", "-i", join(gen, "check", "*-*.png"), "-vf", `scale=480:-1,tile=${cols}x${Math.ceil(shots.length / cols)}:padding=6:color=0x070A10`, "-frames:v", "1", sheet]);
  console.log(`sheet: ${sheet}`);
}
console.log(bad ? `${bad} findings` : "clean");
process.exit(bad ? 1 : 0);
