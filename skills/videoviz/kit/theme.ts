import { Easing } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const serif = loadSerif("normal", { subsets: ["latin"] });
loadSerif("italic", { subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });

/** House style "Nightfield": ink-blue night, warm paper type, one accent per meaning. */
export const C = {
  bg: "#0A0E16",
  bg2: "#111827",
  panel: "#151C2A",
  panelHi: "#1C2537",
  line: "#2A3550",
  dim: "#56627D",
  mute: "#8A95AD",
  paper: "#ECE6D8",
  white: "#FBF8F1",
  claude: "#E8875B", // Claude, authored code, the change under discussion
  live: "#F4C35A", // the live world, players, highlights
  ok: "#5FD3B4", // passed, healthy, the fix
  bad: "#FF5C63", // failure
  cool: "#7AA8FF", // server, network, the engine
  violet: "#A48BFF",
};
export type Color = keyof typeof C;
export const col = (c: string) => (c in C ? C[c as Color] : c);

export const F = { sans: inter.fontFamily, serif: serif.fontFamily, mono: mono.fontFamily };

/** Motion curves: everything settles, nothing bounces unless it is a snap. */
export const E = {
  settle: Easing.bezier(0.16, 1, 0.3, 1),
  glide: Easing.bezier(0.65, 0, 0.35, 1),
  lift: Easing.bezier(0.33, 0, 0.2, 1),
  snap: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: Easing.linear,
};

/** Type scale at 1920×1080. Lint fails labels under 40 and any text under 30 (scaled by width/1920). */
export const T = { title: 88, phrase: 64, label: 44, body: 34, small: 30, hero: 120 };

export const W = 1920;
export const H = 1080;
