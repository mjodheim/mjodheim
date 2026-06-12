// Post-process snk's snake.svg: replace the snake HEAD (.s0) with a bee sprite.
// The body keeps snk's honey-gold colors → "a bee leaving a honey trail".
//
// Usage: node scripts/beeify.mjs dist/snake.svg assets/bee.svg
//
// How it works: snk renders the snake as <rect class="s sN"> animated in CSS.
// s0 is the head. We inject an SVG <pattern> that holds the bee, then force
// .s0 to be filled with that pattern. The rect still follows snk's keyframes,
// so the bee moves on its own. The bee is inlined as a data-URI so the final
// SVG stays self-contained (relative file refs don't load in GitHub READMEs).

import { readFileSync, writeFileSync } from "node:fs";

const svgPath = process.argv[2] ?? "dist/snake.svg";
const beePath = process.argv[3] ?? "assets/bee.svg";

const svg = readFileSync(svgPath, "utf8");
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
console.log(`🐝 Bee head injected into ${svgPath}`);
