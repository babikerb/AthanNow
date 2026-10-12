#!/usr/bin/env node
// Dev tool: renders the six sky ramps (as the app draws them: vertical gradient + 30% opposing diagonal + scrim)
// to a PNG so palette changes can be judged by eye on any machine.
// Usage: node scripts/sky-preview.mjs [out.png]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/design/tokens.generated.ts'), 'utf8');
const stages = JSON.parse(src.match(/export const skyStages = (\{[\s\S]*?\n\}) as const;/)[1]);
const names = Object.keys(stages);

const W = 180, H = 700, GAP = 10;
const outW = names.length * W + (names.length + 1) * GAP;
const outH = H + GAP * 2;
const px = Buffer.alloc(outW * outH * 3, 0x17);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ramp = (cols, p) => {
  const x = Math.max(0, Math.min(1, p)) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex(cols[i]), b = hex(cols[i + 1]);
  return a.map((v, k) => v + (b[k] - v) * f);
};

names.forEach((n, si) => {
  const { colors, scrimBottom } = stages[n];
  const ox = GAP + si * (W + GAP);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = ramp(colors, y / (H - 1));
      // opposing diagonal (start top-right, end bottom-left), as drawn at 30% opacity
      const d = ramp(colors, ((W - 1 - x) / (W - 1) * W * W + (y / (H - 1)) * H * H) / (W * W + H * H) * 1);
      const mix = v.map((c, k) => c * 0.7 + d[k] * 0.3);
      const a = 0.05 + (scrimBottom - 0.05) * (y / (H - 1));
      const o = ((y + GAP) * outW + ox + x) * 3;
      px[o] = mix[0] * (1 - a); px[o + 1] = mix[1] * (1 - a); px[o + 2] = mix[2] * (1 - a);
    }
  }
});

const raw = Buffer.alloc((outW * 3 + 1) * outH);
for (let y = 0; y < outH; y++) px.copy(raw, y * (outW * 3 + 1) + 1, y * outW * 3, (y + 1) * outW * 3);
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(outW, 0); ihdr.writeUInt32BE(outH, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const out = process.argv[2] ?? join(root, 'sky-preview.png');
writeFileSync(out, png);
console.log(`wrote ${out} (${names.join(', ')})`);
