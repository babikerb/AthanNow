#!/usr/bin/env node
// Usage: node scripts/sync-tokens.mjs [--check]
// Reads design/tokens.json, enforces the BRAND.md rules, and generates:
//   src/design/tokens.generated.ts   (JS/TS side)
//   widgets/DesignTokens.swift       (WidgetKit side)
// --check: validate and verify generated files are up to date, write nothing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'design/tokens.json'), 'utf8'));
const checkOnly = process.argv.includes('--check');

// ---------- colour math ----------
const parseHex = (h) => {
  const s = h.replace('#', '');
  if (s.length !== 6 && s.length !== 8) throw new Error(`bad hex ${h}`);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
    a: s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1,
  };
};
const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const contrast = (fgHex, bgHex) => {
  const bg = parseHex(bgHex);
  const fg = over(parseHex(fgHex), bg);
  const a = lum(fg), b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const toOKLab = (hex) => {
  const { r, g, b } = parseHex(hex);
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, Bb), h: ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360 };
};
const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
const oklchToLinear = (L, C, h) => {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
};
// OKLCH -> hex, reducing chroma until in sRGB gamut (never clips hue/lightness).
const oklchToHex = (L, C, h) => {
  let lo = 0, hi = C, c = C;
  const inGamut = (cc) => oklchToLinear(L, cc, h).every((v) => v >= -0.0005 && v <= 1.0005);
  if (!inGamut(c)) { for (let i = 0; i < 24; i++) { c = (lo + hi) / 2; inGamut(c) ? (lo = c) : (hi = c); } c = lo; }
  const [r, g, b] = oklchToLinear(L, c, h).map((v) => gam(Math.max(0, Math.min(1, v))));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
// Perceptual densification: each authored segment is subdivided (SUB steps) with a Catmull-Rom spline through the
// authored OKLCH stops (hue unwrapped along the shortest path), so blends never go muddy in sRGB and there is no
// slope kink at a stop (the horizon peak stays a smooth bloom instead of a visible seam). The final segment into
// the ink stop is interpolated linearly so the spline cannot overshoot below the UI background.
const SUB = 4;
const unwrapHue = (stops) => {
  const hs = [stops[0][2]];
  for (let i = 1; i < stops.length; i++) {
    let d = stops[i][2] - (hs[i - 1] % 360);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    hs.push(hs[i - 1] + d);
  }
  return hs;
};
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const densify = (stops) => {
  const hs = unwrapHue(stops);
  const n = stops.length;
  const P = (i) => { const j = Math.max(0, Math.min(n - 1, i)); return [stops[j][0], stops[j][1], hs[j]]; };
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < SUB; k++) {
      const t = k / SUB;
      const lastSeg = i === n - 2;
      const f = (c) => (lastSeg ? P(i)[c] + (P(i + 1)[c] - P(i)[c]) * t : cr(P(i - 1)[c], P(i)[c], P(i + 1)[c], P(i + 2)[c], t));
      out.push([Math.max(0, f(0)), Math.max(0, f(1)), ((f(2) % 360) + 360) % 360]);
    }
  }
  out.push(stops[n - 1]);
  return out;
};
const hueDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// ---------- resolve colour variants ----------
const C = tokens.color;
const variants = {
  dark: C.dark,
  light: C.light,
  darkHC: { ...C.dark, ...C.highContrast.dark },
  lightHC: { ...C.light, ...C.highContrast.light },
};

// ---------- validation ----------
const errors = [];
const warn = [];
const need = (cond, msg) => { if (!cond) errors.push(msg); };
for (const [vName, v] of Object.entries(variants)) {
  const surfaces = ['bg', 'surface1', 'surface2', 'surface3'];
  for (const s of surfaces) {
    for (const t of ['text', 'textSecondary']) need(contrast(v[t], v[s]) >= 4.5, `${vName}: ${t} on ${s} = ${contrast(v[t], v[s]).toFixed(2)} (<4.5)`);
  }
  for (const s of ['bg', 'surface1']) {
    need(contrast(v.textTertiary, v[s]) >= 4.5, `${vName}: textTertiary on ${s} = ${contrast(v.textTertiary, v[s]).toFixed(2)} (<4.5)`);
    need(contrast(v.accentText, v[s]) >= 4.5, `${vName}: accentText on ${s} = ${contrast(v.accentText, v[s]).toFixed(2)} (<4.5)`);
    need(contrast(v.glyphQuiet, v[s]) >= 3, `${vName}: glyphQuiet on ${s} = ${contrast(v.glyphQuiet, v[s]).toFixed(2)} (<3)`);
  }
  need(contrast(v.onAccentText, v.accentText) >= 4.5, `${vName}: onAccentText on accentText = ${contrast(v.onAccentText, v.accentText).toFixed(2)} (<4.5)`);
  need(contrast(v.onAccent, v.accent) >= 4.5, `${vName}: onAccent on accent = ${contrast(v.onAccent, v.accent).toFixed(2)} (<4.5)`);
  for (const k of ['success', 'warning', 'danger', 'info']) {
    for (const s of ['bg', 'surface1', 'surface2']) need(contrast(v[k], v[s]) >= 4.5, `${vName}: ${k} on ${s} = ${contrast(v[k], v[s]).toFixed(2)} (<4.5)`);
  }
}
// paper (Quran reading surface)
{
  const P = C.paper;
  need(contrast(P.onAccentText, P.accentText) >= 4.5, `paper: onAccentText on accentText = ${contrast(P.onAccentText, P.accentText).toFixed(2)} (<4.5)`);
  need(contrast(P.danger, P.bg) >= 4.5, `paper: danger on bg = ${contrast(P.danger, P.bg).toFixed(2)} (<4.5)`);
  for (const sName of ['bg', 'surface1', 'surface2']) {
    for (const t of ['text', 'textSecondary']) need(contrast(P[t], P[sName]) >= 4.5, `paper: ${t} on ${sName} = ${contrast(P[t], P[sName]).toFixed(2)} (<4.5)`);
  }
  for (const sName of ['bg', 'surface1']) {
    need(contrast(P.textTertiary, P[sName]) >= 4.5, `paper: textTertiary on ${sName} = ${contrast(P.textTertiary, P[sName]).toFixed(2)} (<4.5)`);
    need(contrast(P.accentText, P[sName]) >= 4.5, `paper: accentText on ${sName} = ${contrast(P.accentText, P[sName]).toFixed(2)} (<4.5)`);
    need(contrast(P.glyphQuiet, P[sName]) >= 3, `paper: glyphQuiet on ${sName} = ${contrast(P.glyphQuiet, P[sName]).toFixed(2)} (<3)`);
  }
}
// surface steps (dark): tonal, ink-hued
{
  const ks = ['bg', 'surface1', 'surface2', 'surface3'];
  const labs = ks.map((k) => toOKLab(C.dark[k]));
  for (let i = 1; i < labs.length; i++) need(labs[i].L - labs[i - 1].L >= 0.028, `dark surface step ${ks[i - 1]}->${ks[i]} dL=${(labs[i].L - labs[i - 1].L).toFixed(3)} (<0.028)`);
  labs.forEach((l, i) => {
    need(l.h >= 295 && l.h <= 305, `dark ${ks[i]} hue ${l.h.toFixed(0)} outside 295-305`);
    need(l.C <= 0.045, `dark ${ks[i]} chroma ${l.C.toFixed(3)} > 0.045`);
  });
}
// sky rules
const stageNames = Object.keys(tokens.sky.stages);
const skyHex = {};
const skyDense = {};
for (const name of stageNames) {
  const { stops, scrimBottom } = tokens.sky.stages[name];
  need(stops.length >= 6 && stops.length <= 8, `${name}: needs 6-8 stops`);
  const last = stops[stops.length - 1];
  need(last[0] >= 0.17 && last[0] <= 0.23 && last[1] <= 0.04 && last[2] >= 295 && last[2] <= 305, `${name}: bottom stop must be ink family`);
  let travel = 0;
  stops.forEach((s, i) => {
    const horizon = i >= stops.length - 3 && i < stops.length - 1;
    need(s[1] <= (horizon ? 0.125 : 0.1), `${name}[${i}] chroma ${s[1]} exceeds ${horizon ? 0.125 : 0.1}`);
    // mud floor: mid-lightness stops must carry some chroma (except the ink stop)
    if (i < stops.length - 1 && s[0] >= 0.3 && s[0] <= 0.7) need(s[1] >= 0.025, `${name}[${i}] mud: L ${s[0]} with chroma ${s[1]} < 0.025`);
    if (i > 0 && i < stops.length - 1) {
      const p = stops[i - 1];
      const d = hueDelta(p[2], s[2]);
      // hue travel <= 60 per step, unless the step passes through low chroma (both <= .045)
      const passage = p[1] <= 0.045 && s[1] <= 0.045;
      if (!passage) { travel += d; need(d <= 60, `${name}[${i - 1}->${i}] hue travel ${d} > 60`); }
    }
  });
  need(travel <= 200, `${name}: total hue travel ${travel} > 200`);
  const inkLab = toOKLab(C.dark.bg);
  const lastHex = oklchToHex(...last);
  const lastLab = toOKLab(lastHex);
  need(Math.hypot(lastLab.L - inkLab.L, (lastLab.C * Math.cos((lastLab.h * Math.PI) / 180)) - (inkLab.C * Math.cos((inkLab.h * Math.PI) / 180)), (lastLab.C * Math.sin((lastLab.h * Math.PI) / 180)) - (inkLab.C * Math.sin((inkLab.h * Math.PI) / 180))) <= 0.02, `${name}: bottom stop ${lastHex} is not within 0.02 of bg ${C.dark.bg}`);
  stops.forEach(([L, c, h], i) => {
    const hx = oklchToHex(L, c, h);
    const got = toOKLab(hx);
    if (got.C < c - 0.012) warn.push(`${name}[${i}] gamut-mapped chroma ${c} -> ${got.C.toFixed(3)}`);
  });
  skyHex[name] = stops.map(([L, c, h]) => oklchToHex(L, c, h));
  skyDense[name] = densify(stops).map(([L, c, h]) => oklchToHex(L, c, h));
  // light text must hold AA where text sits (stops 3+), with the stage scrim applied linearly 0.05 -> scrimBottom
  skyHex[name].forEach((hex, i) => {
    if (i < 3) return;
    const p = i / (stops.length - 1);
    const a = 0.05 + (scrimBottom - 0.05) * p;
    const scrimmed = `#${toHex(parseHex(hex).r * (1 - a))}${toHex(parseHex(hex).g * (1 - a))}${toHex(parseHex(hex).b * (1 - a))}`;
    need(contrast(C.dark.skyText, scrimmed) >= 4.5, `${name}[${i}] skyText on sky = ${contrast(C.dark.skyText, scrimmed).toFixed(2)} (<4.5)`);
    need(contrast(C.dark.skyTextSecondary, scrimmed) >= 4.5, `${name}[${i}] skyTextSecondary on sky = ${contrast(C.dark.skyTextSecondary, scrimmed).toFixed(2)} (<4.5)`);
  });
}
{
  const hz = Object.fromEntries(stageNames.map((n) => [n, toOKLab(skyHex[n][skyHex[n].length - 3])]));
  const ab = (l) => [l.C * Math.cos((l.h * Math.PI) / 180), l.C * Math.sin((l.h * Math.PI) / 180)];
  for (let i = 0; i < stageNames.length; i++) for (let j = i + 1; j < stageNames.length; j++) {
    const a = hz[stageNames[i]], b = hz[stageNames[j]];
    const [a1, a2] = ab(a), [b1, b2] = ab(b);
    const dE = Math.hypot(a.L - b.L, a1 - b1, a2 - b2);
    need(dE >= 0.05, `horizon stops ${stageNames[i]} vs ${stageNames[j]} too similar (dE ${dE.toFixed(3)} < 0.05)`);
  }
}
need(tokens.sky.stages.dhuhr.stops[0][0] - tokens.sky.stages.isha.stops[0][0] >= 0.12, 'sky clock spread dhuhr-isha < 0.12 L');

if (errors.length) {
  console.error(`\nsync-tokens: ${errors.length} validation error(s):\n` + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

// ---------- generate TS ----------
const header = '// GENERATED by scripts/sync-tokens.mjs from design/tokens.json. Do not edit.\n';
const ts = `${header}
export const colorTokens = ${JSON.stringify({ dark: variants.dark, light: variants.light, darkHC: variants.darkHC, lightHC: variants.lightHC, paper: C.paper }, null, 2)} as const;

export const spacingTokens = ${JSON.stringify(tokens.spacing)} as const;
export const radiiTokens = ${JSON.stringify(tokens.radii)} as const;
export const typeTokens = ${JSON.stringify(tokens.type, null, 2)} as const;
export const motionTokens = ${JSON.stringify(tokens.motion, null, 2)} as const;

/** Sky gradients, top -> bottom, computed in OKLCH and gamut-mapped to hex. */
export const skyStages = ${JSON.stringify(Object.fromEntries(stageNames.map((n) => [n, { colors: skyDense[n], scrimBottom: tokens.sky.stages[n].scrimBottom, statusBarLight: tokens.sky.stages[n].statusBarLight }])), null, 2)} as const;
export const skyShiftMinutes = ${JSON.stringify(tokens.sky.shiftMinutes)} as const;

export type SkyStage = keyof typeof skyStages;
export type ColorScheme = 'dark' | 'light';
export type ColorToken = keyof typeof colorTokens.dark;
`;

// ---------- generate Swift ----------
const swiftHex = (hex) => { const c = parseHex(hex); return `0x${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}${toHex(c.a * 255)}`; };
const colorKeys = Object.keys(C.dark);
const swiftColors = colorKeys.map((k) => `  static let ${k} = dtDynamic(dark: ${swiftHex(variants.dark[k])}, light: ${swiftHex(variants.light[k])}, darkHC: ${swiftHex(variants.darkHC[k])}, lightHC: ${swiftHex(variants.lightHC[k])})`).join('\n');
const swiftSky = stageNames.map((n) => `  static let ${n}: [Color] = [${skyDense[n].map((h) => `dtColor(0x${h.slice(1)}FF)`).join(', ')}]`).join('\n');
const swift = `// GENERATED by scripts/sync-tokens.mjs from design/tokens.json. Do not edit.
import SwiftUI
import UIKit

private func dtUIColor(_ v: UInt32) -> UIColor {
  UIColor(
    red: CGFloat((v >> 24) & 0xFF) / 255,
    green: CGFloat((v >> 16) & 0xFF) / 255,
    blue: CGFloat((v >> 8) & 0xFF) / 255,
    alpha: CGFloat(v & 0xFF) / 255
  )
}

func dtColor(_ v: UInt32) -> Color { Color(dtUIColor(v)) }

// Light / dark / Increase Contrast variants resolved by the system trait collection.
private func dtDynamic(dark: UInt32, light: UInt32, darkHC: UInt32, lightHC: UInt32) -> Color {
  Color(UIColor { trait in
    let high = trait.accessibilityContrast == .high
    if trait.userInterfaceStyle == .dark { return dtUIColor(high ? darkHC : dark) }
    return dtUIColor(high ? lightHC : light)
  })
}

enum DTColor {
${swiftColors}
}

enum DTSky {
${swiftSky}
  static let shiftMinutes: [String: Double] = ${'[' + Object.entries(tokens.sky.shiftMinutes).map(([k, v]) => `"${k}": ${v}`).join(', ') + ']'}
  static func stops(_ stage: String) -> [Color] {
    switch stage {
${stageNames.map((n) => `    case "${n}": return ${n}`).join('\n')}
    default: return isha
    }
  }
}

enum DTSpacing {
${Object.entries(tokens.spacing).map(([k, v]) => `  static let ${k}: CGFloat = ${v}`).join('\n')}
}

enum DTRadius {
${Object.entries(tokens.radii).map(([k, v]) => `  static let ${k}: CGFloat = ${v}`).join('\n')}
}

enum DTFont {
  /// Fraunces SemiBold (bundled with the widget in Phase 8; falls back to the system font until then).
  static func display(_ size: CGFloat, relativeTo style: Font.TextStyle = .largeTitle) -> Font {
    .custom("${tokens.type.families.display}", size: size, relativeTo: style)
  }
  static func text(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
    .system(size: size, weight: weight)
  }
}
`;

const outputs = [
  [join(root, 'src/design/tokens.generated.ts'), ts],
  [join(root, 'widgets/DesignTokens.swift'), swift],
];
let stale = false;
for (const [path, content] of outputs) {
  if (checkOnly) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== content) { console.error(`stale: ${path}`); stale = true; }
  } else writeFileSync(path, content);
}
if (checkOnly && stale) process.exit(1);
console.log(`sync-tokens: ok (${checkOnly ? 'checked' : 'written'}) — ${stageNames.length} sky stages, ${colorKeys.length} colour tokens x 4 variants`);
if (warn.length) console.warn(warn.join('\n'));
