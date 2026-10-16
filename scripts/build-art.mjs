#!/usr/bin/env node
// Generates the static artwork: assets/banner.svg and assets/about-cosmos.svg
// Usage: node scripts/build-art.mjs --name "Your Name"
// No dependencies. Output is deterministic (seeded), so re-running only changes
// the files if you change the theme, the name or this script.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, esc, rng, text } from './theme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const nameIdx = args.indexOf('--name');
const NAME = nameIdx >= 0 ? args[nameIdx + 1] : 'YOUR NAME';
const TAGLINE = 'Computer Science | Exploring AI, Algorithms & Scientific Computing';

const pt = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

// ---------------------------------------------------------------- banner
function banner() {
  const W = 1200, H = 300;
  const r = rng(2026);
  // Animation parameters come from a separate seeded generator so star positions
  // stay identical to the static version of the banner.
  const ra = rng(99);
  let stars = '';
  for (let i = 0; i < 170; i++) {
    const x = r() * W, y = r() * H;
    const size = 0.4 + r() * r() * 1.5;
    let o = 0.25 + r() * 0.75;
    if (x < 700) o *= 0.5; // keep the text side calm
    const fill = r() > 0.82 ? T.cyan : T.text;
    const twinkle = i % 4 === 0; // about a quarter of the stars twinkle
    const anim = twinkle
      ? ` class="tw" style="--o:${o.toFixed(2)};animation-duration:${(6 + ra() * 6).toFixed(1)}s;animation-delay:-${(ra() * 10).toFixed(1)}s"`
      : '';
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(2)}" fill="${fill}" opacity="${o.toFixed(2)}"${anim}/>`;
  }
  // A few brighter stars with four-point glints
  let glints = '';
  [[870, 52, 7], [1085, 214, 6], [1010, 38, 5], [760, 238, 5]].forEach(([x, y, s]) => {
    glints += `<path class="tw" style="--o:0.9;animation-duration:${(9 + ra() * 4).toFixed(1)}s;animation-delay:-${(ra() * 10).toFixed(1)}s" d="M${x} ${y - s}L${x + 0.9} ${y - 0.9}L${x + s} ${y}L${x + 0.9} ${y + 0.9}L${x} ${y + s}L${x - 0.9} ${y + 0.9}L${x - s} ${y}L${x - 0.9} ${y - 0.9}Z" fill="${T.pale}" opacity="0.9"/>`;
  });

  // Abstract constellation
  const cp = [[830, 205], [885, 160], [950, 172], [1010, 118], [1075, 132], [1120, 82], [962, 236]];
  const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]];
  const lines = links
    .map(([a, b]) => `<line x1="${cp[a][0]}" y1="${cp[a][1]}" x2="${cp[b][0]}" y2="${cp[b][1]}"/>`)
    .join('');
  const dots = cp.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('');

  // Right ascension ticks along the bottom edge
  let ticks = '';
  for (let i = 0; i <= 24; i++) {
    const x = 40 + i * 47.5;
    const major = i % 4 === 0;
    ticks += `<line x1="${x}" y1="${H - 1}" x2="${x}" y2="${H - (major ? 11 : 6)}" stroke="${T.blueLight}" stroke-opacity="0.45"/>`;
    if (major) ticks += text(x, H - 16, `${String(i % 24).padStart(2, '0')}h`, { size: 9, fill: T.textMuted, anchor: 'middle', mono: true, opacity: 0.6 });
  }
  // Declination ticks along the right edge
  let dec = '';
  [['+30°', 70], ['+15°', 135], ['0°', 200]].forEach(([l, y]) => {
    dec += `<line x1="${W - 12}" y1="${y}" x2="${W - 1}" y2="${y}" stroke="${T.blueLight}" stroke-opacity="0.45"/>` +
      text(W - 18, y + 3, l, { size: 9, fill: T.textMuted, anchor: 'end', mono: true, opacity: 0.6 });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bn-t bn-d">
<title id="bn-t">${esc(NAME)} – profile banner</title>
<desc id="bn-d">Deep navy starfield with a faint nebula, orbital paths and an abstract constellation. Text: ${esc(NAME)}, ${esc(TAGLINE)}.</desc>
<style>
  .tw{animation:tw 8s ease-in-out infinite}
  @keyframes tw{0%,100%{opacity:var(--o)}50%{opacity:calc(var(--o)*0.35)}}
  @media (prefers-reduced-motion:reduce){.tw{animation:none}}
</style>
<defs>
  <linearGradient id="bn-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.navyDeep}"/><stop offset="1" stop-color="${T.navyPrimary}"/></linearGradient>
  <radialGradient id="bn-n1" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${T.blueMid}" stop-opacity="0.55"/><stop offset="1" stop-color="${T.blueMid}" stop-opacity="0"/></radialGradient>
  <radialGradient id="bn-n2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#46549F" stop-opacity="0.34"/><stop offset="1" stop-color="#46549F" stop-opacity="0"/></radialGradient>
  <radialGradient id="bn-n3" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${T.blueLight}" stop-opacity="0.28"/><stop offset="1" stop-color="${T.blueLight}" stop-opacity="0"/></radialGradient>
  <linearGradient id="bn-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${T.navyDeep}" stop-opacity="0.78"/><stop offset="0.55" stop-color="${T.navyDeep}" stop-opacity="0.35"/><stop offset="1" stop-color="${T.navyDeep}" stop-opacity="0"/></linearGradient>
  <filter id="bn-blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
  <clipPath id="bn-clip"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#bn-clip)">
  <rect width="${W}" height="${H}" fill="url(#bn-bg)"/>
  <g filter="url(#bn-blur)">
    <ellipse cx="930" cy="150" rx="330" ry="95" transform="rotate(-16 930 150)" fill="url(#bn-n1)"/>
    <ellipse cx="1040" cy="95" rx="210" ry="70" transform="rotate(-24 1040 95)" fill="url(#bn-n2)"/>
    <ellipse cx="800" cy="230" rx="230" ry="60" transform="rotate(-10 800 230)" fill="url(#bn-n3)"/>
  </g>
  <g fill="none" stroke="${T.blueDark}" stroke-width="1" opacity="0.7">
    <circle cx="980" cy="420" r="260"/><circle cx="980" cy="420" r="330"/><circle cx="980" cy="420" r="400"/>
  </g>
  <g fill="none" stroke="${T.blueLight}" stroke-width="1" stroke-dasharray="3 6" opacity="0.38">
    <ellipse cx="960" cy="152" rx="300" ry="86" transform="rotate(-18 960 152)"/>
    <ellipse cx="960" cy="152" rx="200" ry="52" transform="rotate(-18 960 152)"/>
  </g>
  <circle cx="${(960 + 300 * Math.cos(0.5) * Math.cos(-0.314) - 86 * Math.sin(0.5) * Math.sin(-0.314)).toFixed(1)}" cy="${(152 + 300 * Math.cos(0.5) * Math.sin(-0.314) + 86 * Math.sin(0.5) * Math.cos(-0.314)).toFixed(1)}" r="4" fill="${T.cyan}"/>
  ${stars}
  ${glints}
  <g stroke="${T.blueLight}" stroke-opacity="0.55" stroke-width="1">${lines}</g>
  <g fill="${T.pale}">${dots}</g>
  ${ticks}
  ${dec}
  <rect width="${W}" height="${H}" fill="url(#bn-shade)"/>
  ${text(60, 96, 'FIRST-YEAR CSE STUDENT', { size: 12, fill: T.cyan, spacing: 3, mono: true })}
  ${text(58, 154, NAME, { size: 58, weight: 700, fill: '#FFFFFF', spacing: 0.5 })}
  <rect x="60" y="176" width="96" height="2" fill="${T.blueLight}"/>
  ${text(60, 212, TAGLINE, { size: 20, fill: T.pale })}
</g>
</svg>
`;
}

// ---------------------------------------------------------------- about art
function aboutArt() {
  const W = 480, H = 360, cx = 236, cy = 128;
  const r = rng(7);
  let trails = '';
  for (let i = 0; i < 16; i++) {
    const rad = 28 + i * 13 + r() * 4;
    const a0 = r() * 360;
    const len = 50 + r() * 140;
    const col = i % 3 === 0 ? T.cyan : T.blueLight;
    trails += `<path d="${arc(cx, cy, rad.toFixed(1) * 1, a0, a0 + len)}" stroke="${col}" stroke-width="${(0.7 + r() * 1.1).toFixed(2)}" stroke-opacity="${(0.4 + r() * 0.5).toFixed(2)}" fill="none" stroke-linecap="round"/>`;
  }
  let stars = '';
  for (let i = 0; i < 70; i++) {
    stars += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * 250).toFixed(1)}" r="${(0.4 + r() * r() * 1.2).toFixed(2)}" fill="${T.text}" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ab-t ab-d">
<title id="ab-t">Star trails above an observatory</title>
<desc id="ab-d">A long-exposure style illustration: concentric star trails circle the celestial pole above a small observatory dome on a dark horizon.</desc>
<defs>
  <linearGradient id="ab-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.navyDeep}"/><stop offset="0.7" stop-color="${T.navyPrimary}"/><stop offset="1" stop-color="${T.blueDark}"/></linearGradient>
  <radialGradient id="ab-pole" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${T.pale}" stop-opacity="0.9"/><stop offset="1" stop-color="${T.blueLight}" stop-opacity="0"/></radialGradient>
  <radialGradient id="ab-glow" cx="50%" cy="100%" r="70%"><stop offset="0" stop-color="${T.blueMid}" stop-opacity="0.55"/><stop offset="1" stop-color="${T.blueMid}" stop-opacity="0"/></radialGradient>
  <clipPath id="ab-clip"><rect width="${W}" height="${H}" rx="14"/></clipPath>
</defs>
<g clip-path="url(#ab-clip)">
  <rect width="${W}" height="${H}" fill="url(#ab-bg)"/>
  <rect y="190" width="${W}" height="170" fill="url(#ab-glow)"/>
  ${stars}
  <g fill="none" stroke="${T.blueDark}" stroke-width="1" stroke-dasharray="2 5" opacity="0.9">
    <circle cx="${cx}" cy="${cy}" r="60"/><circle cx="${cx}" cy="${cy}" r="120"/><circle cx="${cx}" cy="${cy}" r="180"/>
  </g>
  ${trails}
  <circle cx="${cx}" cy="${cy}" r="22" fill="url(#ab-pole)"/>
  <circle cx="${cx}" cy="${cy}" r="2.6" fill="#FFFFFF"/>
  <path d="M0 296 C60 282 110 292 170 286 C230 280 300 296 360 288 C410 282 450 288 480 284 L480 360 L0 360Z" fill="${T.navyDeep}" stroke="${T.blueMid}" stroke-opacity="0.6"/>
  <g transform="translate(330 0)">
    <rect x="-34" y="262" width="68" height="30" fill="${T.navyPrimary}" stroke="${T.blueMid}"/>
    <path d="M-34 262 A34 34 0 0 1 34 262Z" fill="${T.navyPrimary}" stroke="${T.blueMid}"/>
    <path d="M-5 229 L5 229 L9 262 L-9 262Z" fill="${T.blueDark}"/>
    <line x1="0" y1="229" x2="14" y2="206" stroke="${T.blueLight}" stroke-width="3" stroke-linecap="round"/>
    <rect x="-6" y="274" width="12" height="18" fill="${T.blueDark}"/>
  </g>
  ${text(18, 338, 'Star trails around the celestial pole', { size: 11, fill: T.textMuted, mono: true, opacity: 0.85 })}
</g>
</svg>
`;
}

await mkdir(path.join(ROOT, 'assets'), { recursive: true });
await writeFile(path.join(ROOT, 'assets/banner.svg'), banner());
await writeFile(path.join(ROOT, 'assets/about-cosmos.svg'), aboutArt());
console.log(`Wrote assets/banner.svg and assets/about-cosmos.svg for "${NAME}"`);
