// Turn snk's snake.svg into a *real* growing Snake that never bites its own tail.
//
// Usage: node scripts/beeify.mjs dist/snake.svg assets/bee.svg
//
// Why we rebuild the path
// -----------------------
// snk computes a path that is self-avoiding only for ITS fixed snake length (4).
// As soon as the body grows past that, the path revisits cells still occupied by
// the tail → the snake crosses itself. So we throw away snk's path and make the
// bee sweep the whole contribution grid in a boustrophedon (row-major serpentine):
//
//   row 0:  →→→→→→→→→→→
//   row 1:  ←←←←←←←←←←←
//   row 2:  →→→→→→→→→→→   ...
//
// A contiguous arc along a serpentine can never intersect itself, at ANY length.
// The bee starts 3 cells long and grows by one every time it passes over a
// contribution (which is also the moment that dot is "eaten"). We keep snk's grid
// dots and honey colors, and only rewrite the snake + the dots' eat timing.
//
// The bee head is inlined as a data-URI so the SVG stays self-contained in READMEs.

import { readFileSync, writeFileSync } from "node:fs";

const svgPath = process.argv[2] ?? "dist/snake.svg";
const beePath = process.argv[3] ?? "assets/bee.svg";

const START_LEN = 3; // classic Snake starting length (head + 2 body cells)
const STEP_MS = 70; // wall-clock time the bee spends per grid cell
const CELL = 16; // grid pitch in px (snk uses 16px cells)

let svg = readFileSync(svgPath, "utf8");

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

// --- 1) read snk's grid: bounds + which cells are contributions -------------

let maxCol = 0,
  maxRow = 0;
const contrib = new Map(); // "col,row" -> { cid, color }  (color = original snk level)
for (const m of svg.matchAll(/<rect class="c(?: c(\d+))?"([^>]*)\/>/g)) {
  const a = m[2];
  const col = Math.round((+/x="([\d.-]+)"/.exec(a)[1] - 2) / CELL);
  const row = Math.round((+/y="([\d.-]+)"/.exec(a)[1] - 2) / CELL);
  maxCol = Math.max(maxCol, col);
  maxRow = Math.max(maxRow, row);
  if (m[1] !== undefined) {
    const cid = +m[1];
    const color = (new RegExp(`\\.c\\.c${cid}\\{fill:var\\((--c\\d)\\)`).exec(svg) || [])[1] ?? "--c2";
    contrib.set(`${col},${row}`, { cid, color });
  }
}

// --- 2) build the row-major serpentine path (with a left-side entrance) ------

const grid = [];
for (let row = 0; row <= maxRow; row++) {
  if (row % 2 === 0) for (let col = 0; col <= maxCol; col++) grid.push([col, row]);
  else for (let col = maxCol; col >= 0; col--) grid.push([col, row]);
}
// Staging: the bee slides in from the left edge so it starts 3 cells long.
const stage = [];
for (let i = START_LEN; i >= 1; i--) stage.push([-i, 0]);
const path = [...stage, ...grid];

const TOTAL = path.length;
const periodMs = TOTAL * STEP_MS;
// The journey fills 0–99% of the timeline; 99–100% snaps back to the start for a
// clean infinite loop (hidden by the body fade-out below).
const pctOf = (i) => (i / (TOTAL - 1)) * 99;
const stepMsEff = ((99 / (TOTAL - 1)) / 100) * periodMs; // one-cell delay between body cells

// Eat moment for each contribution = when the head passes over it (path order).
const eatPct = [];
const eatByCid = new Map();
path.forEach(([col, row], i) => {
  const hit = contrib.get(`${col},${row}`);
  if (hit) {
    const p = pctOf(i);
    eatPct.push(p);
    eatByCid.set(hit.cid, { pct: p, color: hit.color });
  }
});

const maxLen = START_LEN + eatPct.length; // final snake length

// --- 3) head keyframes s0 (serpentine, compressed to turns) -----------------

const dir = (a, b) => `${Math.sign(b[0] - a[0])},${Math.sign(b[1] - a[1])}`;
const turns = [];
for (let i = 0; i < TOTAL; i++) {
  const isTurn =
    i === 0 ||
    i === TOTAL - 1 ||
    dir(path[i - 1], path[i]) !== dir(path[i], path[i + 1]);
  if (isTurn) turns.push(i);
}
let headKf = "@keyframes s0{";
for (const i of turns) {
  const [c, r] = path[i];
  headKf += `${pctOf(i).toFixed(3)}%{transform:translate(${c * CELL}px,${r * CELL}px)}`;
}
// hold on the last cell until the loop wraps (the body has faded out by then,
// so the instant jump back to the start is invisible — no fly-back streak).
headKf += `100%{transform:translate(${path[TOTAL - 1][0] * CELL}px,${path[TOTAL - 1][1] * CELL}px)}}`;

// --- 4) growing body: 17 trailing cells + opacity "birth" tracks ------------

const FADE = (100 / TOTAL) * 0.8; // sub-cell pop-in
// Birth time of body cell m: cells 1..START_LEN-1 slide in with the head; every
// later cell is born the instant its matching contribution is eaten.
const birthPct = (m) => (m < START_LEN ? pctOf(m) : eatPct[m - START_LEN]);

let rects = "";
let opacityKf = "";
for (let m = 1; m < maxLen; m++) {
  const born = birthPct(m);
  const delay = (m * stepMsEff).toFixed(2);
  opacityKf += `@keyframes b${m}{0%,${born.toFixed(3)}%{opacity:0}${(born + FADE).toFixed(3)}%,99.4%{opacity:1}99.9%,100%{opacity:0}}`;
  rects += `<rect class="s" x="1.8" y="1.8" width="12.3" height="12.3" rx="4.1" ry="4.1" style="animation-name:s0,b${m};animation-delay:${delay}ms,0ms"/>`;
}

// --- 5) splice everything into snk's SVG ------------------------------------

// New global period (snk hard-codes 20500ms on every animation).
svg = svg.replaceAll("20500ms", `${periodMs}ms`);

// Drop snk's fixed-length body (cells s1+): rects, rules and keyframes.
svg = svg.replace(/<rect class="s s(?!0")\d+"[^>]*\/>/g, "");
svg = svg.replace(/\.s(?!0\b)\d+\{[^}]*\}/g, "");
for (let n = 1; ; n++) {
  const kf = keyframes(`s${n}`);
  if (!kf) break;
  svg = svg.slice(0, kf.start) + svg.slice(kf.end);
}

// Replace the head path with our serpentine.
{
  const old = keyframes("s0");
  svg = svg.slice(0, old.start) + headKf + svg.slice(old.end);
}

// Retime each contribution dot so it disappears exactly as the bee passes it.
for (const [cid, { pct, color }] of eatByCid) {
  const old = keyframes(`c${cid}`);
  const fresh = `@keyframes c${cid}{0%,${pct.toFixed(3)}%{fill:var(${color})}${(pct + FADE).toFixed(3)}%,100%{fill:var(--ce)}}`;
  svg = svg.slice(0, old.start) + fresh + svg.slice(old.end);
}

// Inject the growing body right after the head rect, and the opacity keyframes.
svg = svg.replace(/(<rect class="s s0"[^>]*\/>)/, `$1${rects}`);
svg = svg.replace(/<\/style>/, `${opacityKf}</style>`);

// --- 6) swap the head for the bee sprite ------------------------------------

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
  `🐝 Serpentine bee snake: ${START_LEN} → ${maxLen} cells, sweeping ${maxCol + 1}×${maxRow + 1} grid over ${eatPct.length} contributions (${(periodMs / 1000).toFixed(1)}s loop) → ${svgPath}`,
);
