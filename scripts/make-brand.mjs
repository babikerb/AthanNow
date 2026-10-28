#!/usr/bin/env node
// Draws the AthanNow app icon, "True dawn": a deep night sky with a single thin line of first light lying
// flat along the horizon, fading out at both ends, with a soft glow spreading just above it and dark ground
// below. True dawn (al-fajr al-sadiq) is light spreading horizontally along the horizon, the moment Fajr begins.
// No dependencies: each pixel is computed analytically with supersampling, then PNG-encoded.
//
//   node scripts/make-brand.mjs [outDir]   writes icon.png, icon-dark.png, icon-tinted.png (default: assets/)
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ?? join(root, 'assets');
const N = 1024;
const SS = 3;

// Geometry (1024 canvas).
const HORIZON = 612; // the line of light
const LINE_HALF = 5.5; // half-thickness of the bright core
const SPAN = 440; // half-length of the line before it has fully faded
const GLOW_UP = 210; // how far the glow reaches above the horizon
const GLOW_DOWN = 120; // and below, so the light carries onto the ground instead of stopping dead

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
function gradient(stops, t) {
  for (let i = 0; i < stops.length - 1; i++) if (t <= stops[i + 1][1]) return mix(hex(stops[i][0]), hex(stops[i + 1][0]), (t - stops[i][1]) / (stops[i + 1][1] - stops[i][1]));
  return hex(stops.at(-1)[0]);
}
const add = (c, light, a) => c.map((v, i) => Math.min(255, v + light[i] * a));

function sample(x, y, look) {
  // Sky above the horizon, ground below.
  let c = y < HORIZON ? gradient(look.sky, y / HORIZON) : gradient(look.ground, (y - HORIZON) / (N - HORIZON));
  // Horizontal falloff: full in the middle, gone by +-SPAN (a soft cosine-like ease).
  const dx = Math.abs(x - 512) / SPAN;
  const along = dx >= 1 ? 0 : Math.pow(Math.cos((dx * Math.PI) / 2), 1.6);
  if (along > 0) {
    const dy = y - HORIZON;
    // Wide soft glow, stronger and taller above the line than below it.
    const reach = dy < 0 ? GLOW_UP : GLOW_DOWN;
    const glow = Math.exp(-Math.pow(dy / reach, 2) * 2.2) * along;
    c = add(c, look.glow, glow * look.glowA);
    // A tighter warm halo hugging the line.
    const halo = Math.exp(-Math.pow(dy / 22, 2)) * along;
    c = add(c, look.halo, halo * look.haloA);
    // The bright core: a thin line with soft edges.
    const core = (1 - smooth(LINE_HALF - 1.5, LINE_HALF + 3, Math.abs(dy))) * Math.pow(along, 0.8) * 0.9;
    c = mix(c, look.core, core);
  }
  return c;
}

function render(look) {
  const px = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < SS; j++) {
        for (let i = 0; i < SS; i++) {
          const c = sample(x + (i + 0.5) / SS, y + (j + 0.5) / SS, look);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = SS * SS;
      const o = (y * N + x) * 4;
      // A whisper of grain keeps the large gradients from banding.
      const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) * 2 - 1;
      px[o] = Math.max(0, Math.min(255, r / n + grain * look.grain));
      px[o + 1] = Math.max(0, Math.min(255, g / n + grain * look.grain));
      px[o + 2] = Math.max(0, Math.min(255, b / n + grain * look.grain));
      px[o + 3] = 255;
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
function png(px) {
  const raw = Buffer.alloc(N * (N * 3 + 1));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) for (let k = 0; k < 3; k++) raw[y * (N * 3 + 1) + 1 + x * 3 + k] = px[(y * N + x) * 4 + k];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const looks = {
  // Night lifting toward dawn: deep navy, a hint of violet near the horizon.
  'icon.png': {
    sky: [['#070A1E', 0], ['#101639', 0.5], ['#23265A', 0.85], ['#383068', 1]],
    ground: [['#2E2858', 0], ['#17142F', 0.4], ['#08070F', 1]],
    glow: hex('#F4A274'), glowA: 0.78,
    halo: hex('#FFD9A2'), haloA: 0.95,
    core: hex('#FFF1DC'),
    grain: 1.2,
  },
  // Dark Home Screen: the same moment, quieter.
  'icon-dark.png': {
    sky: [['#04050F', 0], ['#090C22', 0.5], ['#141638', 0.85], ['#1E1C40', 1]],
    ground: [['#1C1A3C', 0], ['#0D0C1F', 0.4], ['#030308', 1]],
    glow: hex('#E59A6C'), glowA: 0.66,
    halo: hex('#F7CC92'), haloA: 0.85,
    core: hex('#FBEBD2'),
    grain: 1,
  },
  // Tinted: iOS recolours by luminance. Black ground, a white line, grey glow.
  'icon-tinted.png': {
    sky: [['#000000', 0], ['#050505', 0.85], ['#0B0B0B', 1]],
    ground: [['#0B0B0B', 0], ['#030303', 0.4], ['#000000', 1]],
    glow: hex('#FFFFFF'), glowA: 0.45,
    halo: hex('#FFFFFF'), haloA: 0.75,
    core: hex('#FFFFFF'),
    grain: 0,
  },
};
for (const [name, look] of Object.entries(looks)) {
  writeFileSync(join(outDir, name), png(render(look)));
  console.log('wrote ' + join(outDir, name));
}
