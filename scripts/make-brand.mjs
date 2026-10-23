#!/usr/bin/env node
// Draws the AthanNow app icons from the app's own Maghrib sky scene (src/components/sky): the same
// skyline paths, sun and sky colours, cropped tight on the mosque so buildings and ground fill the icon.
// No dependencies: SVG paths are flattened and scanline-filled with supersampling, then PNG-encoded.
//
//   node scripts/make-brand.mjs [outDir]   writes icon.png, icon-dark.png, icon-tinted.png and splash-icon.png
//   (default: assets/). splash-icon.png is the light icon as a rounded tile on transparency for the launch
//   screen; src/components/LaunchSplash.tsx starts from exactly this tile, so keep CROP and TILE_RADIUS in sync.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? join(root, 'assets');
const N = 1024;
const SS = 4;

// ---- Scene source ----
const ill = readFileSync(join(root, 'src/components/sky/SkyIllustration.tsx'), 'utf8');
const skyline = ill
  .match(/const SKYLINE = \[([\s\S]*?)\]\.join/)[1]
  .match(/'([^']+)'/g)
  .map((s) => s.slice(1, -1))
  .join(' ');
const palJs = ts.transpileModule(readFileSync(join(root, 'src/components/sky/palettes.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const pal = {};
new Function('exports', palJs)(pal);
const maghrib = pal.SCENES.maghrib;

// Square crop of the 390 x 340 scene around the main dome; extends below the art into ink ground.
export const CROP = { x: 190, y: 160, size: 200 };
/** Launch-screen tile corner radius as a fraction of its side. */
export const TILE_RADIUS = 0.2237;
const HORIZON = 318; // top of the ground strip in scene units
const K = N / CROP.size;
const toPx = (x, y) => [(x - CROP.x) * K, (y - CROP.y) * K];

// ---- Path flattening (M L H V C Z, absolute) into polygons in pixel space ----
function flatten(d) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+/g);
  const polys = [];
  let cur = null;
  let cx = 0, cy = 0, cmd = '', i = 0;
  const num = () => parseFloat(tokens[i++]);
  const push = (x, y) => cur.push(toPx(x, y));
  while (i < tokens.length) {
    if (/[MLHVCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') { cx = num(); cy = num(); cur = []; polys.push(cur); push(cx, cy); cmd = 'L'; }
    else if (cmd === 'L') { cx = num(); cy = num(); push(cx, cy); }
    else if (cmd === 'H') { cx = num(); push(cx, cy); }
    else if (cmd === 'V') { cy = num(); push(cx, cy); }
    else if (cmd === 'C') {
      const [x1, y1, x2, y2, x, y] = [num(), num(), num(), num(), num(), num()];
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, u = 1 - t;
        push(u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
      }
      cx = x; cy = y;
    } else if (cmd === 'Z') { cmd = ''; }
  }
  return polys;
}
const SKY_POLYS = flatten(skyline);

/** Coverage mask (N x N, 0..1) for a set of polygons, union of even-odd fills, 4x4 supersampled. */
function mask(polys) {
  const m = new Float32Array(N * N);
  const edges = [];
  for (const p of polys) for (let j = 0; j < p.length; j++) edges.push([p[j], p[(j + 1) % p.length], polys.indexOf(p)]);
  for (let sy = 0; sy < N * SS; sy++) {
    const y = (sy + 0.5) / SS;
    const row = new Uint8Array(N * SS);
    const byPoly = new Map();
    for (const [[x0, y0], [x1, y1], pi] of edges) {
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        if (!byPoly.has(pi)) byPoly.set(pi, []);
        byPoly.get(pi).push(x);
      }
    }
    for (const xs of byPoly.values()) {
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] * SS - 0.5)), b = Math.min(N * SS - 1, Math.floor(xs[k + 1] * SS - 0.5));
        for (let sx = a; sx <= b; sx++) row[sx] = 1;
      }
    }
    const py = Math.floor(sy / SS);
    for (let sx = 0; sx < N * SS; sx++) if (row[sx]) m[py * N + Math.floor(sx / SS)] += 1 / (SS * SS);
  }
  return m;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function gradient(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][1]) return mix(hex(stops[i][0]), hex(stops[i + 1][0]), (t - stops[i][1]) / (stops[i + 1][1] - stops[i][1]));
  return hex(stops.at(-1)[0]);
}
function discCoverage(px, py, cx, cy, r) {
  let c = 0;
  for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) if ((px + (i + 0.5) / SS - cx) ** 2 + (py + (j + 0.5) / SS - cy) ** 2 <= r * r) c++;
  return c / (SS * SS);
}

const skylineMask = mask(SKY_POLYS);
const [sunX, sunY] = toPx(maghrib.body.x, maghrib.body.y);
const sunR = maghrib.body.r * K;
const horizonPx = (HORIZON - CROP.y) * K;
// Maghrib's faint early stars, in the upper sky (scene units).
const STARS = [[214, 176, 1.1], [256, 168, 0.8], [372, 182, 1]];

function render(look) {
  const px = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    const sky = gradient(look.sky, Math.min(1, y / horizonPx));
    for (let x = 0; x < N; x++) {
      let c = sky;
      for (const [sx, sy, r] of STARS) {
        const [X, Y] = toPx(sx, sy);
        if (Math.abs(x - X) < 12 && Math.abs(y - Y) < 12) c = mix(c, look.star, discCoverage(x, y, X, Y, r * K) * look.starA);
      }
      if (Math.abs(x - sunX) <= sunR + 2 && Math.abs(y - sunY) <= sunR + 2) c = mix(c, look.sun, discCoverage(x, y, sunX, sunY, sunR));
      const ground = y + 1 <= horizonPx ? 0 : y >= horizonPx ? 1 : y + 1 - horizonPx;
      c = mix(c, look.ink, Math.min(1, skylineMask[y * N + x] + ground));
      const o = (y * N + x) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  return px;
}

// ---- PNG encode (RGB 8-bit) ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (b) => {
  let c = -1;
  for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(px, alpha = false) {
  const ch = alpha ? 4 : 3;
  const raw = Buffer.alloc(N * (N * ch + 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let k = 0; k < ch; k++) raw[y * (N * ch + 1) + 1 + x * ch + k] = px[(y * N + x) * 4 + k];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const looks = {
  // The Maghrib scene as drawn on Home (band palette, top to horizon).
  'icon.png': { sky: maghrib.sky.map((c, i) => [c, i / (maghrib.sky.length - 1)]), sun: hex(maghrib.body.color), ink: hex(pal.INK), star: hex('#FFFFFF'), starA: 0.5 },
  // Dark Home Screen: the same scene a little later, deeper sky and a dimmer sun.
  'icon-dark.png': { sky: [['#1E1730', 0], ['#4A2F45', 0.45], ['#9A5A4E', 0.8], ['#B8744F', 1]], sun: hex('#E9B98A'), ink: hex('#0B0910'), star: hex('#FFFFFF'), starA: 0.6 },
  // Tinted: iOS recolours by luminance. Grey sky brightening to the horizon, white sun, black skyline.
  'icon-tinted.png': { sky: [['#101010', 0], ['#2A2A2A', 0.6], ['#5A5A5A', 1]], sun: hex('#FFFFFF'), ink: hex('#000000'), star: hex('#FFFFFF'), starA: 0.5 },
};
for (const [name, look] of Object.entries(looks)) {
  writeFileSync(join(outDir, name), png(render(look)));
  console.log('wrote ' + join(outDir, name));
}

// Launch-screen tile: the light icon with rounded corners (plain circular corners, matching the
// borderRadius the in-app splash animates from).
{
  const px = render(looks['icon.png']);
  const R = TILE_RADIUS * N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = Math.max(0, R - x, x + 1 - (N - R));
      const dy = Math.max(0, R - y, y + 1 - (N - R));
      if (dx === 0 || dy === 0) continue;
      let c = 0;
      for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
        const X = x + (i + 0.5) / SS, Y = y + (j + 0.5) / SS;
        const cx = X < R ? R : N - R, cy = Y < R ? R : N - R;
        if ((X - cx) ** 2 + (Y - cy) ** 2 <= R * R) c++;
      }
      px[(y * N + x) * 4 + 3] = Math.round((255 * c) / (SS * SS));
    }
  }
  writeFileSync(join(outDir, 'splash-icon.png'), png(px, true));
  console.log('wrote ' + join(outDir, 'splash-icon.png'));
}
