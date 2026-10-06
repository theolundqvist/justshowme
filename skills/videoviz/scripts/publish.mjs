#!/usr/bin/env node
// publish.mjs <dir> [name…] [--gif|--mp4|--png] [--frame N] [--frames A-B] [--out FILE]: render compositions for places a live page can't go.
// Defaults by kind: video → MP4, pointer → GIF (two-pass palette, 1280 px, under ~5 MB), still → PNG. Low priority; workers scale with measured memory headroom.
// --frames A-B renders only frames A..B (inclusive) as a silent slice, out/<id>.<A>.mp4; join.mjs concatenates slices and adds the mix once.
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { comps } from "./dev.mjs";

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const only = args.filter((a, i) => !a.startsWith("--") && i > 0 && !["--frame", "--frames", "--out"].includes(args[i - 1]));
const range = opt("--frames")?.split("-").map(Number);
const force = args.includes("--gif") ? "gif" : args.includes("--mp4") ? "mp4" : args.includes("--png") ? "png" : null;
const gen = join(dir, ".videoviz");
const outDir = join(dir, "out");
// One Chrome tab per worker. Memory stalls (PSI) force a single worker; otherwise each worker needs ~2 GB of MemAvailable
// (3 GB when swap is nearly full, since nothing can spill) and ~3 idle cores.
const workers = (() => {
  if (!existsSync("/proc/meminfo")) return Math.max(1, Math.min(4, Math.floor(availableParallelism() / 4)));
  const meminfo = readFileSync("/proc/meminfo", "utf8");
  const kb = (k) => Number(meminfo.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? 0);
  const [, avg10, avg60] = readFileSync("/proc/pressure/memory", "utf8").match(/full avg10=(\S+) avg60=(\S+)/).map(Number);
  const swapTight = kb("SwapTotal") > 0 && kb("SwapFree") < kb("SwapTotal") * 0.1;
  const idle = availableParallelism() - Number(readFileSync("/proc/loadavg", "utf8").split(" ")[0]);
  const n = Math.max(1, Math.min(6, Math.floor(idle / 3), Math.floor((kb("MemAvailable") * 1024 - 2e9) / (swapTight ? 3e9 : 2e9))));
  const pick = Math.max(avg10, avg60) > 1 ? 1 : n;
  console.log(`workers ${pick} (memory PSI full ${avg10}/${avg60}, ${(kb("MemAvailable") / 1048576).toFixed(0)} GB available, swap ${swapTight ? "nearly full" : "ok"}, ${idle.toFixed(0)} idle cores)`);
  return pick;
})();
mkdirSync(outDir, { recursive: true });
import("node:os").then((o) => o.setPriority(19)).catch(() => {});

const names = comps(dir).map((f) => f.replace(/\.tsx$/, "")).filter((n) => !only.length || only.includes(n));
const tl = existsSync(join(dir, "timeline.json")) ? JSON.parse(readFileSync(join(dir, "timeline.json"), "utf8")) : null;
writeFileSync(
  join(gen, "remotion.tsx"),
  `import React from "react";\nimport { Composition, registerRoot } from "remotion";\nimport { Main, resolve } from "videoviz";\n` +
    names.map((n, i) => `import * as c${i} from ${JSON.stringify(join(dir, n + ".tsx"))};`).join("\n") +
    `\nconst tl = ${JSON.stringify(tl)};\n` +
    `const list = [${names.map((n, i) => `[${JSON.stringify(n)}, c${i}]`).join(", ")}] as const;\n` +
    // Props cross a JSON boundary into the renderer, so the scene is closed over, never passed as a prop.
    `const comps = list.map(([id, m]) => { const r = resolve((m as any).meta, tl); const C = () => <Main Scene={(m as any).default} tl={tl} audio={r.kind === "video"} />; return { id, r, C }; });\n` +
    `registerRoot(() => <>{comps.map(({ id, r, C }) => <Composition key={id} id={id} component={C} durationInFrames={r.frames} fps={r.fps} width={1920} height={1080} />)}</>);\n`,
);

// The bundler copies publicDir wholesale, so stage only what staticFile() can reach, and bundle outside the video dir.
const pub = join(gen, "public");
rmSync(pub, { recursive: true, force: true });
for (const d of ["assets", "audio"]) if (existsSync(join(dir, d))) cpSync(join(dir, d), join(pub, d), { recursive: true });
const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: join(gen, "remotion.tsx"),
  publicDir: pub,
  outDir: join(tmpdir(), "videoviz-bundle", dir.replace(/\W+/g, "_")),
  webpackOverride: (c) => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), videoviz: join(skill, "kit/index.ts") }, modules: [join(skill, "node_modules"), "node_modules"] } }),
});
console.log(`bundled in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

for (const id of names) {
  const comp = await selectComposition({ serveUrl, id, inputProps: {} });
  const src = readFileSync(join(dir, id + ".tsx"), "utf8");
  const kind = /kind:\s*"pointer"/.test(src) ? "pointer" : /kind:\s*"still"/.test(src) ? "still" : tl ? "video" : "pointer";
  const fmt = force ?? { video: "mp4", pointer: "gif", still: "png" }[kind];
  const file = opt("--out") ?? join(outDir, `${id}${range ? `.${String(range[0]).padStart(6, "0")}` : ""}.${fmt}`);
  const t1 = Date.now();
  if (fmt === "png") {
    await renderStill({ composition: comp, serveUrl, output: file, frame: Number(opt("--frame") ?? 0), chromiumOptions: { gl: "swangle" } });
  } else {
    const mp4 = fmt === "gif" ? join(gen, `${id}.gif-src.mp4`) : file;
    let last = -1;
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: "h264",
      outputLocation: mp4,
      concurrency: workers,
      imageFormat: "jpeg",
      jpegQuality: 92,
      crf: fmt === "gif" ? 12 : 18,
      muted: kind !== "video" || range !== undefined,
      frameRange: range,
      chromiumOptions: { gl: "swangle" },
      onProgress: ({ progress }) => { const k = Math.floor(progress * 10); if (k !== last) { last = k; process.stdout.write(`\r  ${id} ${k * 10}%`); } },
    });
    process.stdout.write("\n");
    if (fmt === "gif") {
      // Two-pass palette; ordered dither keeps unchanged pixels identical between frames, so only the moving parts cost bytes. Step down until under 5 MB.
      const fps = Math.min(20, comp.fps);
      const pal = join(gen, `${id}.palette.png`);
      for (const [w, cap] of [[1280, 5e6], [1120, 5e6], [960, Infinity]]) {
        execFileSync("nice", ["-n", "19", "ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", `fps=${fps},scale=${w}:-1:flags=lanczos,palettegen=max_colors=128:stats_mode=diff`, pal]);
        execFileSync("nice", ["-n", "19", "ffmpeg", "-v", "error", "-y", "-i", mp4, "-i", pal, "-lavfi", `fps=${fps},scale=${w}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, "-loop", "0", file]);
        if (statSync(file).size < cap) break;
      }
      rmSync(mp4);
      rmSync(pal);
    }
  }
  const mb = (statSync(file).size / 1e6).toFixed(1);
  console.log(`${file}  ${mb} MB  rendered in ${((Date.now() - t1) / 1000).toFixed(0)} s`);
}
