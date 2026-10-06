#!/usr/bin/env node
// dev.mjs <dir> [--port 8490] [--once]: bundle every composition in <dir> into a live Player page and serve it (audio, scrubber, reload on save).
import * as esbuild from "esbuild";
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skill = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dir = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
const port = Number(args[args.indexOf("--port") + 1] || 0) || 8490;
const once = args.includes("--once");

/** Every .tsx at the top of the dir is a composition; its default export is the scene, `meta` its Meta. */
export const comps = (d) => readdirSync(d).filter((f) => f.endsWith(".tsx") && !f.startsWith("_")).sort();

export const buildOptions = (d, entry, out) => ({
  entryPoints: [entry],
  outfile: out,
  bundle: true,
  format: "esm",
  jsx: "automatic",
  loader: { ".json": "json" },
  alias: { videoviz: join(skill, "kit/index.ts") },
  nodePaths: [join(skill, "node_modules")],
  define: { "process.env.NODE_ENV": '"development"' },
  sourcemap: "inline",
  logLevel: "warning",
});

export const writeEntry = (d) => {
  const gen = join(d, ".videoviz");
  mkdirSync(gen, { recursive: true });
  const files = comps(d);
  writeFileSync(
    join(gen, "entry.tsx"),
    `import { mount } from ${JSON.stringify(join(skill, "kit/player.tsx"))};\n` +
      files.map((f, i) => `import * as c${i} from ${JSON.stringify(join(d, f))};`).join("\n") +
      `\nmount([${files.map((f, i) => `{ name: ${JSON.stringify(f.replace(/\.tsx$/, ""))}, mod: c${i} }`).join(", ")}]);\n`,
  );
  writeFileSync(
    join(gen, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${d.split("/").pop()}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#070A10;color:#ECE6D8;font:15px Inter,system-ui,sans-serif}main{max-width:1280px;margin:0 auto;padding:24px 16px 64px}h2{font:600 13px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A95AD;margin:32px 0 10px}.wait{padding:48px;text-align:center;color:#8A95AD;border:1px dashed #2A3550;border-radius:12px}body.lint main{max-width:none;padding:0}body.lint h2{display:none}</style>
</head><body><main id="root"></main><script type="module" src="/.videoviz/app.js"></script>
<script>new EventSource('/.videoviz/events').onmessage=()=>location.reload()</script></body></html>`,
  );
  return gen;
};

const clients = new Set();
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".webm": "video/webm", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".svg": "image/svg+xml", ".wav": "audio/wav" };

/** Static server rooted at the video dir, so staticFile("assets/x.jpg") resolves the same here as in a publish render. Range support lets the scrubber seek audio. */
export const serve = (d, p) =>
  createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/.videoviz/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    let f = join(d, url === "/" ? ".videoviz/index.html" : url);
    if (!f.startsWith(d) || !existsSync(f) || statSync(f).isDirectory()) return res.writeHead(404).end("not found");
    const size = statSync(f).size;
    const h = { "content-type": types[extname(f)] ?? "application/octet-stream", "accept-ranges": "bytes", "cache-control": "no-store" };
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
    if (m) {
      const a = m[1] ? +m[1] : size - +m[2], b = m[1] && m[2] ? +m[2] : size - 1;
      res.writeHead(206, { ...h, "content-range": `bytes ${a}-${b}/${size}`, "content-length": b - a + 1 });
      return createReadStream(f, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...h, "content-length": size });
    createReadStream(f).pipe(res);
  }).listen(p, function () {
    console.log(`live: http://localhost:${this.address().port}/`);
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  const gen = writeEntry(dir);
  const t0 = Date.now();
  const opts = buildOptions(dir, join(gen, "entry.tsx"), join(gen, "app.js"));
  if (once) {
    await esbuild.build(opts);
    console.log(`built in ${Date.now() - t0} ms`);
    process.exit(0);
  }
  const reload = { name: "reload", setup: (b) => b.onEnd((r) => { if (!r.errors.length) { console.log(`built ${new Date().toTimeString().slice(0, 8)}`); for (const c of clients) c.write("data: reload\n\n"); } }) };
  const ctx = await esbuild.context({ ...opts, plugins: [reload] });
  await ctx.watch();
  serve(dir, port);
  // New composition files and a finished voice pass (timeline.json) also reload the page.
  let known = comps(dir).join();
  let tl = existsSync(join(dir, "timeline.json")) ? statSync(join(dir, "timeline.json")).mtimeMs : 0;
  setInterval(async () => {
    const now = comps(dir).join();
    const t = existsSync(join(dir, "timeline.json")) ? statSync(join(dir, "timeline.json")).mtimeMs : 0;
    if (now !== known) { known = now; writeEntry(dir); await ctx.rebuild(); }
    else if (t !== tl) { tl = t; for (const c of clients) c.write("data: reload\n\n"); }
  }, 1000);
}
