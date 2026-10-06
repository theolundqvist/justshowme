#!/usr/bin/env node
// join.mjs <dir> <name> [--out FILE]: join silent slices out/<name>.<A>.mp4 (from publish.mjs --frames A-B) into out/<name>.mp4,
// stream-copied, with audio/mix.m4a laid over the whole video once. Slices must cover frames 0..N without gaps or overlaps.
import { execFileSync } from "node:child_process";
import { readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const [dirArg, name] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
if (!dirArg || !name) throw new Error("usage: join.mjs <dir> <name> [--out FILE]");
const dir = resolve(dirArg);
const outDir = join(dir, "out");
const out = args.includes("--out") ? resolve(args[args.indexOf("--out") + 1]) : join(outDir, `${name}.mp4`);
const probe = (file, entries) =>
  execFileSync("ffprobe", ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", entries, "-of", "csv=p=0", file], { encoding: "utf8" }).trim();

const slices = readdirSync(outDir)
  .map((f) => f.match(new RegExp(`^${name.replace(/\W/g, "\\$&")}\\.(\\d{6})\\.mp4$`)))
  .filter(Boolean)
  .map((m) => ({ file: join(outDir, m[0]), start: Number(m[1]) }))
  .sort((a, b) => a.start - b.start);
if (!slices.length) throw new Error(`no slices out/${name}.<frame>.mp4 in ${outDir}`);

let next = 0;
let fps;
const list = [];
for (const s of slices) {
  const [rate, frames] = probe(s.file, "stream=r_frame_rate,nb_read_packets").split(",");
  const [num, den] = rate.split("/").map(Number);
  fps ??= num / den;
  if (s.start !== next) throw new Error(`slice ${s.file} starts at frame ${s.start}, expected ${next}`);
  next += Number(frames);
  // Pin each seam to the slice's frame count; container padding (e.g. an AAC tail) would otherwise shift every later frame.
  list.push(`file '${s.file}'`, `duration ${(Number(frames) / fps).toFixed(6)}`);
}
const listFile = join(outDir, `.${name}.concat.txt`);
writeFileSync(listFile, list.join("\n") + "\n");
execFileSync(
  "ffmpeg",
  ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-i", join(dir, "audio", "mix.m4a"), "-map", "0:v", "-map", "1:a", "-c", "copy", "-shortest", "-movflags", "+faststart", out],
  { stdio: "inherit" },
);
rmSync(listFile);
console.log(`${out}: ${slices.length} slices, ${next} frames, ${(next / fps).toFixed(3)} s`);
