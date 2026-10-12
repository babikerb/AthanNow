#!/usr/bin/env node
// Recolours the existing AthanNow wordmark icon (cream letters on a flat background) into the brand palette, with no
// new dependencies. The wordmark shapes are untouched: each pixel's position between the old background and the old
// letter colour is kept (so anti-aliasing is preserved) and remapped onto new colours from design/tokens.json.
//
// Usage: node scripts/make-icons.mjs <source.png> <outDir>
//   writes icon.png (light/default), icon-dark.png, icon-tinted.png
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'design/tokens.json'), 'utf8'));
const [src, outDir] = process.argv.slice(2);
if (!src || !outDir) throw new Error('usage: make-icons.mjs <source.png> <outDir>');

// ---- PNG decode (8-bit, non-interlaced, colour type 2 or 6) ----
const buf = readFileSync(src);
let off = 8, W = 0, H = 0, ct = 0;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); if (data[8] !== 8 || data[12] !== 0) throw new Error('need 8-bit non-interlaced PNG'); ct = data[9]; }
  if (type === 'IDAT') idat.push(data);
  off += 12 + len;
}
if (ct !== 2 && ct !== 6) throw new Error('need RGB or RGBA PNG, got colour type ' + ct);
const bpp = ct === 6 ? 4 : 3;
const raw = inflateSync(Buffer.concat(idat));
const stride = W * bpp;
const px = Buffer.alloc(H * stride);
for (let y = 0; y < H; y++) {
  const f = raw[y * (stride + 1)];
  for (let x = 0; x < stride; x++) {
    const v = raw[y * (stride + 1) + 1 + x];
    const a = x >= bpp ? px[y * stride + x - bpp] : 0;
    const b = y > 0 ? px[(y - 1) * stride + x] : 0;
    const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
    let r;
    if (f === 0) r = v;
    else if (f === 1) r = v + a;
    else if (f === 2) r = v + b;
    else if (f === 3) r = v + ((a + b) >> 1);
    else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
    px[y * stride + x] = r & 255;
  }
}
const at = (x, y) => [px[y * stride + x * bpp], px[y * stride + x * bpp + 1], px[y * stride + x * bpp + 2]];

// Old background = corner pixel; old letter colour = the most distant colour from it found on the image.
const bg = at(4, 4);
let fg = bg, best = -1;
for (let y = 0; y < H; y += 7) for (let x = 0; x < W; x += 7) {
  const p = at(x, y);
  const d = (p[0] - bg[0]) ** 2 + (p[1] - bg[1]) ** 2 + (p[2] - bg[2]) ** 2;
  if (d > best) { best = d; fg = p; }
}
const axis = [fg[0] - bg[0], fg[1] - bg[1], fg[2] - bg[2]];
const axisLen2 = axis[0] ** 2 + axis[1] ** 2 + axis[2] ** 2;
const coverage = (p) => Math.max(0, Math.min(1, ((p[0] - bg[0]) * axis[0] + (p[1] - bg[1]) * axis[1] + (p[2] - bg[2]) * axis[2]) / axisLen2));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ink = hex(tokens.color.dark.bg);
const apricot = hex(tokens.color.dark.accent);
const black = [0, 0, 0];
const white = [255, 255, 255];

// ---- PNG encode (RGB, no alpha: iOS icons must be opaque) ----
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function write(name, from, to) {
  const out = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = coverage(at(x, y));
      const o = y * (W * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(from[k] + (to[k] - from[k]) * t);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(join(outDir, name), png);
  console.log('wrote', name, `${from} -> ${to}`);
}
console.log(`source ${W}x${H}, old bg ${bg}, old letters ${fg}`);
write('icon.png', ink, apricot); // light / default: apricot wordmark on ink
write('icon-dark.png', ink, apricot); // dark appearance: the icon is already dark
write('icon-tinted.png', black, white); // tinted: greyscale, the system applies the tint
