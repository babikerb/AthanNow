import React, { memo, useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

import { INK, SCENES, ScenePeriod, STAR_FIELD } from './palettes';

// Authored once on a 390 x 340 viewBox; `xMidYMax slice` keeps the skyline anchored to the bottom
// edge and crops sky (never ground) on other aspect ratios.
const RIDGE_FAR = 'M0 226 C58 198 112 214 162 204 C222 191 262 224 322 209 C352 201 374 206 390 199 L390 340 L0 340 Z';
const RIDGE_MID = 'M0 262 C52 243 102 260 152 249 C204 238 252 262 302 254 C342 248 370 257 390 249 L390 340 L0 340 Z';
const RIDGE_NEAR = 'M0 296 C62 282 122 296 182 288 C242 280 302 298 390 286 L390 340 L0 340 Z';

// Mosque skyline. Main dome and both minarets sit in the right third; a lower dome, a slim
// minaret and an arcade wall balance the left.
const SKYLINE = [
  // ground
  'M0 318 H390 V340 H0 Z',
  // left: arcade wall with a low dome
  'M18 318 V298 H128 V318 Z',
  'M48 298 C48 280 60 270 73 268 C86 270 98 280 98 298 Z',
  'M72 268 V258 H74 V268 Z',
  // left slim minaret
  'M140 318 V256 H147 V318 Z',
  'M138 262 H149 V265 H138 Z',
  'M140 256 L143.5 242 L147 256 Z',
  // main prayer hall
  'M226 318 V284 H340 V318 Z',
  // drum + main dome
  'M246 284 V277 H318 V284 Z',
  'M248 277 C248 247 266 233 282 230 C298 233 316 247 316 277 Z',
  // finial
  'M281 230 V214 H283 V230 Z',
  // right-third minarets
  'M212 318 V230 H222 V318 Z',
  'M209 264 H225 V268 H209 Z',
  'M212 230 L217 210 L222 230 Z',
  'M346 318 V238 H356 V318 Z',
  'M343 270 H359 V274 H343 Z',
  'M346 238 L351 220 L356 238 Z',
  // small side dome
  'M362 318 V300 H390 V318 Z',
  'M364 300 C364 290 370 284 377 283 C384 284 390 290 390 300 Z',
].join(' ');

// Top of the far ridge in viewBox units; a body pushed lower than this sinks behind the hills.
const HORIZON = 200;

/**
 * `clearTop` is the height (pt) of chrome drawn over the top of the scene (city, date). The sun or
 * moon is kept below it, so on a short band it sits low over the hills instead of behind the text.
 */
function SkyIllustrationImpl({ period, width, height, clearTop = 0 }: { period: ScenePeriod; width: number; height: number; clearTop?: number }) {
  const scene = SCENES[period];
  const id = useId().replace(/:/g, '');
  const s = Math.max(width / 390, height / 340);
  const visibleTop = 340 - height / s;
  const minY = visibleTop + clearTop / s + scene.body.r + 6;
  const body = scene.body.y < HORIZON && scene.body.y < minY ? { ...scene.body, y: Math.min(minY, HORIZON - scene.body.r * 0.3) } : scene.body;
  const stops = scene.sky;

  return (
    <Svg width={width} height={height} viewBox="0 0 390 340" preserveAspectRatio="xMidYMax slice">
      <Defs>
        <LinearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          {stops.map((c, i) => (
            <Stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
        {body.kind === 'crescent' && (
          <Mask id={`moon${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={390} height={340}>
            <Circle cx={body.x} cy={body.y} r={body.r} fill="#fff" />
            <Circle cx={body.x + (body.waning ? 1 : -1) * body.r * 0.58} cy={body.y - body.r * 0.18} r={body.r * 1.02} fill="#000" />
          </Mask>
        )}
      </Defs>

      {/* Extends above the viewBox so a taller-than-authored screen never shows a seam. */}
      <Rect x={0} y={-400} width={390} height={740} fill={stops[0]} />
      <Rect x={0} y={0} width={390} height={340} fill={`url(#sky${id})`} />

      {scene.stars > 0 && (
        <G opacity={scene.starOpacity}>
          {STAR_FIELD.slice(0, scene.stars).map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
          ))}
        </G>
      )}

      {scene.clouds && (
        <G fill="#FFFFFF">
          <Ellipse cx={118} cy={150} rx={72} ry={9} opacity={0.16} />
          <Ellipse cx={150} cy={160} rx={46} ry={6} opacity={0.12} />
          <Ellipse cx={286} cy={176} rx={88} ry={10} opacity={0.12} />
        </G>
      )}

      {body.kind === 'sun' ? (
        <Circle cx={body.x} cy={body.y} r={body.r} fill={body.color} />
      ) : (
        <Circle cx={body.x} cy={body.y} r={body.r} fill={body.color} mask={`url(#moon${id})`} />
      )}

      {scene.ridges.length === 3 && (
        <>
          <Path d={RIDGE_FAR} fill={scene.ridges[0]} />
          <Path d={RIDGE_MID} fill={scene.ridges[1]} />
          <Path d={RIDGE_NEAR} fill={scene.ridges[2]} />
        </>
      )}

      <Path d={SKYLINE} fill={INK} />
    </Svg>
  );
}

export const SkyIllustration = memo(SkyIllustrationImpl);
