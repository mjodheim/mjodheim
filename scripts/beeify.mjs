// Post-process snk's snake.svg into a *real* Snake: the bee starts 3 cells long
// and grows by one every time it eats a contribution — then we swap the head for
// a bee sprite. The body keeps snk's honey-gold colors → "a bee leaving a honey
// trail that gets longer as it feeds".
//
// Usage: node scripts/beeify.mjs dist/snake.svg assets/bee.svg
//
// How it works
// ------------
// snk renders the snake as a *fixed-length* train of <rect class="s sN">. Each
// body cell follows the exact same path as the head (s0), just delayed by one
// grid-step per cell. snk encodes that as separate @keyframes per cell, so the
// length can never change.
//
// We rebuild the body from a single source of truth — the head's @keyframes s0:
//   • a body cell M is simply the head animation delayed by M grid-steps
//     (CSS `animation-delay`), so all cells share `animation-name: s0` and form
//     one contiguous, rigid trail behind the bee.
//   • the snake starts at length 3 (head + 2 body cells). Cell M (M >= 3) is
//     hidden (opacity 0) until the head eats its (M-2)-th contribution, then it
//     pops in at the tail — that's the "grow by 1" rule.
//
// The eat moments come straight from snk's @keyframes cN (a dot flips to the
// background color the instant the head reaches it). The bee head is inlined as
// a data-URI so the SVG stays self-contained in GitHub READMEs.

import { readFileSync, writeFileSync } from "node:fs";

const svgPath = process.argv[2] ?? "dist/snake.svg";
const beePath = process.argv[3] ?? "assets/bee.svg";

const START_LEN = 3; // classic Snake starting length (head + 2 body cells)

let svg = readFileSync(svgPath, "utf8");

// --- helpers ---------------------------------------------------------------

// Extract a full, brace-balanced @keyframes <name>{...} block.
function keyframes(name) {
  const start = svg.indexOf(`@keyframes ${name}{`);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + `@keyframes ${name}`.length; i < svg.length; i++) {
    if (svg[i] === "{") depth++;
    else if (svg[i] === "}" && --depth === 0)
      return { text: svg.slice(start, i + 1), start, end: i + 1 };
  }
  return null;
}

// --- 1) timing constants ---------------------------------------------------

const periodMatch = svg.match(/animation:\s*none\s+linear\s+(\d+)ms/);
if (!periodMatch) throw new Error("Could not find animation period in SVG");
const periodMs = Number(periodMatch[1]);

// One grid-step, in % of the timeline: take the longest straight run of the
// head path and divide its duration by the number of cells it covers.
const head = keyframes("s0");
if (!head) throw new Error("No @keyframes s0 (snake head) found");
const headPts = [
  ...head.text.matchAll(/([\d.]+)%\{transform:translate\((-?\d+)px,(-?\d+)px\)\}/g),
].map((m) => ({ pct: +m[1], x: +m[2], y: +m[3] }));

let stepPct = Infinity;
for (let i = 1; i < headPts.length; i++) {
  const a = headPts[i - 1],
    b = headPts[i];
  const cells = (Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / 16;
  // skip the wrap-around pair (staging frame at ~99.5% → first cell at ~0.5%)
  if (cells >= 1 && b.pct > a.pct) stepPct = Math.min(stepPct, (b.pct - a.pct) / cells);
}
if (!isFinite(stepPct)) throw new Error("Could not derive grid-step duration");
const stepMs = (stepPct / 100) * periodMs; // ≈ 100ms per cell

// --- 2) eat moments (sorted) ----------------------------------------------

// A contribution dot flips to --ce (background) the instant it is eaten.
const eatTimes = [
  ...svg.matchAll(/@keyframes c\d+\{[\d.]+%\{[^}]*\}([\d.]+)%,[\d.]+%\{fill:var\(--ce\)\}\}/g),
]
  .map((m) => +m[1])
  .sort((a, b) => a - b);

const maxLen = START_LEN + eatTimes.length; // final snake length

// --- 3) strip snk's fixed-length body (cells s1+) --------------------------

// Remove their rects, their .sN rules and their @keyframes — keep only s0.
svg = svg.replace(/<rect class="s s(?!0")\d+"[^>]*\/>/g, "");
svg = svg.replace(/\.s(?!0\b)\d+\{[^}]*\}/g, "");
for (let n = 1; ; n++) {
  const kf = keyframes(`s${n}`);
  if (!kf) break;
  svg = svg.slice(0, kf.start) + svg.slice(kf.end);
}

// --- 4) build the growing body --------------------------------------------

// Birth time of cell M: cells 1..START_LEN-1 are present from the start; every
// later cell is born when its matching contribution is eaten.
const birthPct = (m) => (m < START_LEN ? 0 : eatTimes[m - START_LEN]);

const FADE = Math.min(stepPct, 0.4); // quick pop-in, ~one grid-step
let rects = "";
let opacityKf = "";
for (let m = 1; m < maxLen; m++) {
  const born = birthPct(m);
  const delayMs = +(m * stepMs).toFixed(2);
  // opacity track: hidden until birth, visible, then fade out before the loop
  // resets so the long tail never "snaps" back to the staging stack.
  opacityKf +=
    born <= 0
      ? `@keyframes b${m}{0%,99.4%{opacity:1}99.9%,100%{opacity:0}}`
      : `@keyframes b${m}{0%,${born}%{opacity:0}${(born + FADE).toFixed(2)}%,99.4%{opacity:1}99.9%,100%{opacity:0}}`;
  // uniform body cell (snk's s1 silhouette); transform reuses the head path.
  rects += `<rect class="s" x="1.8" y="1.8" width="12.3" height="12.3" rx="4.1" ry="4.1" style="animation-name:s0,b${m};animation-delay:${delayMs}ms,0ms"/>`;
}

// Inject the body cells right after the head rect, and the opacity keyframes
// into the existing <style>.
svg = svg.replace(/(<rect class="s s0"[^>]*\/>)/, `$1${rects}`);
svg = svg.replace(/<\/style>/, `${opacityKf}</style>`);

// --- 5) swap the head for the bee sprite -----------------------------------

const beeData =
  "data:image/svg+xml;base64," +
  Buffer.from(readFileSync(beePath, "utf8")).toString("base64");

const inject = `
<defs>
  <pattern id="bee" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
    <image href="${beeData}" x="-0.2" y="-0.2" width="1.4" height="1.4" preserveAspectRatio="xMidYMid meet"/>
  </pattern>
</defs>
<style>.s.s0{ fill:url(#bee) !important; }</style>
`;

if (!svg.includes("</svg>")) {
  throw new Error(`No closing </svg> tag found in ${svgPath}`);
}

writeFileSync(svgPath, svg.replace("</svg>", `${inject}</svg>`));
console.log(
  `🐝 Growing bee snake: ${START_LEN} → ${maxLen} cells over ${eatTimes.length} contributions (step ${stepMs.toFixed(1)}ms) → ${svgPath}`,
);
