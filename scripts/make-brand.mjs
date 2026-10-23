#!/usr/bin/env node
// Draws the AthanNow app icons and splash mark from geometry (no dependencies, no source art):
// a dusk sky, the sun's arc in gold with the sun on it, and a small mosque on ink ground.
// The in-app animated splash (src/components/LaunchSplash.tsx) uses the same numbers; keep them in sync.
//
//   node scripts/make-brand.mjs   writes assets/icon.png, icon-dark.png, icon-tinted.png, splash-icon.png
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const N = 1024;
const SS = 3; // supersamples per axis

// ---- Geometry (1024 canvas) ----
export const GROUND = 806;
export const ARC = { cx: 512, cy: GROUND, r: 340, w: 22 };
export const SUN_DEG = 70;
export const SUN_R = 66;
const sunAt = (deg) => [ARC.cx + ARC.r * Math.cos((deg * Math.PI) / 180), ARC.cy - ARC.r * Math.sin((deg * Math.PI) / 180)];
const DOME = { cx: 512, cy: GROUND - 28, r: 156 };
const MINARETS = [318, 678]; // left edge x; 28 wide
const STARS = [
  [228, 248, 7],
  [330, 168, 4.5],
  [168, 410, 4.5],
  [404, 300, 3.5],
  [862, 232, 5],
];

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function gradient(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) {
    const [ca, oa] = stops[i];
    const [cb, ob] = stops[i + 1];
    if (t <= ob) return mix(hex(ca), hex(cb), (t - oa) / (ob - oa));
  }
  return hex(stops.at(-1)[0]);
}

function inMosque(x, y) {
  if (y >= GROUND) return true;
  const dx = x - DOME.cx;
  const dy = y - DOME.cy;
  if (dx * dx + dy * dy <= DOME.r * DOME.r) return true;
  // finial: stem and ball
  if (Math.abs(x - 512) <= 3.5 && y >= DOME.cy - DOME.r - 40 && y <= DOME.cy - DOME.r + 4) return true;
  if ((x - 512) ** 2 + (y - (DOME.cy - DOME.r - 46)) ** 2 <= 81) return true;
  for (const mx of MINARETS) {
    const top = GROUND - 196;
    const tip = top - 44;
    if (x >= mx && x <= mx + 28 && y >= top) return true; // shaft
    if (x >= mx - 7 && x <= mx + 35 && y >= top + 46 && y <= top + 57) return true; // balcony
    if (y >= tip && y < top) {
      const half = ((y - tip) / (top - tip)) * 14;
      if (Math.abs(x - (mx + 14)) <= half) return true; // cap
    }
  }
  return false;
}

/**
 * Paints one sample. `look` picks the variant: colours, and whether the arc stops short of the sun.
 */
function sample(x, y, look) {
  let c = gradient(look.sky, y / N);
  for (const [sx, sy, r] of STARS) if ((x - sx) ** 2 + (y - sy) ** 2 <= r * r) c = mix(c, look.star, look.starA);
  const [sx, sy] = sunAt(SUN_DEG);
  const dSun = Math.hypot(x - sx, y - sy);
  const dArc = Math.abs(Math.hypot(x - ARC.cx, y - ARC.cy) - ARC.r);
  if (y <= ARC.cy && dArc <= ARC.w / 2 && (!look.gap || dSun > SUN_R + 20)) c = mix(c, look.gold, look.arcA);
  if (dSun <= SUN_R) c = look.gold;
  if (inMosque(x, y)) c = look.ink;
  return c;
}

function render(look) {
  const px = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const sxp = x + (i + 0.5) / SS;
          const syp = y + (j + 0.5) / SS;
          const c = sample(sxp, syp, look);
          if (look.transparentBg && !c.painted) {
            // transparent canvas: only marks count
          }
          r += c[0]; g += c[1]; b += c[2]; a += c[3] ?? 255;
        }
      }
      const n = SS * SS;
      const o = (y * N + x) * 4;
      px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n; px[o + 3] = a / n;
    }
  }
  return px;
}

// Splash mark: transparent background, so each sample carries alpha.
function renderMark(look) {
  const px = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const X = x + (i + 0.5) / SS;
          const Y = y + (j + 0.5) / SS;
          let c = null;
          let al = 0;
          const [sx, sy] = sunAt(SUN_DEG);
          const dArc = Math.abs(Math.hypot(X - ARC.cx, Y - ARC.cy) - ARC.r);
          if (Y <= ARC.cy && dArc <= ARC.w / 2) { c = hex(look.gold); al = look.arcA; }
          if (Math.hypot(X - sx, Y - sy) <= SUN_R) { c = hex(look.gold); al = 1; }
          // Splash ground is a short base under the mosque, not a full-width band.
          const inSil = Y < GROUND ? inMosque(X, Y) : Y <= GROUND + 18 && Math.abs(X - 512) <= 250;
          if (inSil) { c = hex(look.ink); al = 1; }
          if (c) { r += c[0] * al; g += c[1] * al; b += c[2] * al; a += al * 255; }
        }
      }
      const n = SS * SS;
      const o = (y * N + x) * 4;
      const alpha = a / n;
      // un-premultiply
      const k = alpha > 0 ? 255 / a : 0;
      px[o] = r * k; px[o + 1] = g * k; px[o + 2] = b * k; px[o + 3] = alpha;
    }
  }
  return px;
}

// ---- PNG encode (RGBA 8-bit) ----
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
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(px, opaque) {
  const ch = opaque ? 3 : 4;
  const raw = Buffer.alloc(N * (N * ch + 1));
  for (let y = 0; y < N; y++) {
    raw[y * (N * ch + 1)] = 0;
    for (let x = 0; x < N; x++) for (let k = 0; k < ch; k++) raw[y * (N * ch + 1) + 1 + x * ch + k] = px[(y * N + x) * 4 + k];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const GOLD = '#F2C14E';
const INK = '#17121F';
const looks = {
  'icon.png': { sky: [['#1A1530', 0], ['#33274F', 0.55], ['#6E4560', 1]], gold: hex(GOLD), ink: hex(INK), star: hex('#F2EDF6'), starA: 0.85, arcA: 0.9, gap: true },
  'icon-dark.png': { sky: [['#0F0C1A', 0], ['#1E1832', 0.6], ['#3A2645', 1]], gold: hex(GOLD), ink: hex('#0B0910'), star: hex('#F2EDF6'), starA: 0.7, arcA: 0.9, gap: true },
  // Tinted: iOS recolours by luminance, so marks are white and the ground a dim grey on black.
  'icon-tinted.png': { sky: [['#000000', 0], ['#000000', 1]], gold: hex('#FFFFFF'), ink: hex('#1C1C1C'), star: hex('#FFFFFF'), starA: 0.6, arcA: 0.75, gap: true },
};

for (const [name, look] of Object.entries(looks)) {
  writeFileSync(join(root, 'assets', name), png(render(look), true));
  console.log('wrote assets/' + name);
}
writeFileSync(join(root, 'assets', 'splash-icon.png'), png(renderMark({ gold: GOLD, ink: '#0E0B16', arcA: 0.9 }), false));
console.log('wrote assets/splash-icon.png');
