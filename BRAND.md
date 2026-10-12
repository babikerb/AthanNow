# BRAND.md — AthanNow (Phase 2)

**Thesis:** *A quiet room at dusk.* Ink-dark surfaces step up tonally, one warm apricot light marks what matters, and the sky does the talking.

**Personality:** reverent · calm · precise · warm · unhurried.
**Colour decision:** supersedes the old green brand (`#315C46` / `#4FAE86`) and near-black neutrals. Green is removed everywhere (no leftover hex).

## 1. Palette (contrast ratios computed; all body text ≥ 4.5:1 on the surfaces it is allowed on)
### Dark (default, priority)
| Token | Hex | Notes |
|---|---|---|
| `bg` | `#17121F` | near-black ink, never "purple UI" |
| `surface1` | `#1E1828` | grouped list rows, cards |
| `surface2` | `#261F33` | raised: sheets, inputs, pressed rows |
| `surface3` | `#30283F` | highest: popovers, selected chip |
| `hairline` | `rgba(255,255,255,0.08)` (range .06–.10) | all borders/dividers; never solid grey |
| `text` | `#EDE8F2` | 15.3:1 on bg. Never `#FFFFFF`. |
| `textSecondary` | `#9C93AB` | 6.3:1 bg, 4.8:1 surface3 |
| `textTertiary` | `#8A819B` | 5.0:1 bg, 4.7:1 s1. **Only on bg/surface1, never over the Home sky** (sky screens use `skyTextSecondary` only). On s2/s3 use secondary. |
| `glyphQuiet` | `#6E6680` | **chevrons and decorative dividers only** (3.4:1, meets 3:1 non-text). Disabled controls use `textTertiary`, never this. |
| `accent` | `#E8B07A` | soft apricot; 9.6:1 on bg. Ink text on accent fill = 9.6:1 |
| `accentSoft` | accent @ 14% | selected wash on *surfaces* (lists/segments), never decoration |
| `skyFill` / `skyHairline` / `skyWash` | sky-text @ 10% / 16% / 8% | translucent fills on the always-night sky (location pill, progress track, current-row wash). Home's current row uses `skyWash` (8%) + a 3pt `accent` tick; not `accentSoft`. |
| `success` | `#7FB89A` · `warning #D9A25E` · `danger #E08A8A` · `info #8FA6D6` | desaturated; ≥ 6.2:1 on every dark surface |
### Light (secondary, lavender paper)
bg `#F3F0F7` · s1 `#FAF8FC` · s2 `#E9E4F0` · s3 `#DED7E8` · hairline ink@10% · text `#1F1A28` (15:1) · secondary `#5E566E` (6.1:1) · tertiary `#6A6179` (≥4.5:1, validator will confirm) · accent: fills/large `#B8742F`; accent *text* = deepest same-hue (OKLCH h≈64°) value reaching ≥4.5:1 on bg/s1 (token validator picks it, expected ≈`#9A5F24`), one hue family with the dark-mode apricot · semantic darkened ~25%.
### Surface step rule (verified in OKLab)
bg L .195 → s1 .224 → s2 .257 → s3 .296 (ΔL .029/.033/.039; hue 299–301°; chroma .027–.042). Rule: adjacent surface steps ΔL ≥ 0.029 and all neutral surfaces stay within hue 295–305°, chroma ≤ 0.045, so it reads as ink, not a "purple theme". Rows are separated by the tonal step *and* the hairline; the token validator enforces.
### Accent budget (enforceable)
Accent may appear as (a) **one** filled/large element per screen: the primary button, or on Home the thin progress rule; (b) small state markers: active tab tint, selected check/radio, toggle-on, current-prayer row marker + `accentSoft` wash, Qibla "aligned". Never on body text, decorative icons, borders, or card backgrounds. `palette` SF Symbol rendering (accent + secondary) is used only for the Qibla needle glyph; everything else is `hierarchical`.
### Increase Contrast
Hairline → 18% (dark) / 22% (light), secondary/tertiary text step one tone toward primary, accent unchanged. Provided as asset-catalog high-contrast variants in Phase 3.
### Always-night surfaces
Home (sky) and Qibla are permanently dark and use sky-text tokens: `skyText #F2EDF6`, `skyTextSecondary` = text @ 82%. Quran reading surface uses the *paper* palette: `#F4EFE8` page / `#2E2833` ink (warm, lavender-neutral; replaces `#F6F1E5`/`#3A3128`).

## 2. Typography
**Pairing:** **Fraunces** (static `Fraunces_600SemiBold` from `@expo-google-fonts/fraunces` 0.4.x; the variable opsz axis is NOT used) for **display, title1 and hero numerals only**; title2 and below are SF Pro (avoids a fussy mix); **SF Pro** (system) for everything else; **Amiri Quran** unchanged for scripture. Delivered via `@expo-google-fonts/fraunces` + `expo-font` (JS-side font files, no native API change). Widgets bundle the same TTF (Phase 8i, logged).
**Scale** (pt, line, tracking): caption2 11/14/+0.2 · caption 12/16/+0.2 · footnote 13/18/0 · subhead 15/20/0 · body 17/24/0 · bodyEmph 17/24 semi · headline 17/22 semi · title3 20/26/-0.2 · title2 24/30/-0.4 · title1 30/36/-0.6 (Fraunces) · display 40/44/-1.0 (Fraunces) · hero 64/68/-2.0 (Fraunces, countdown only).
Rules: **Phase 3 gate:** verify on device that Fraunces gives lining + tabular figures with `fontVariant: ['lining-nums','tabular-nums']`; if not, the countdown digits fall back to SF Pro Semibold tabular so they never jitter (Fraunces stays for words/titles). Large titles tight tracking; labels/eyebrows and prayer-name labels may be uppercase +0.8 at caption2/footnote only (sentence case applies to prose); **tabular numerals** (`fontVariant: ['tabular-nums']`) for every time/countdown/count; all text scales with Dynamic Type (`allowFontScaling`, no hard cap except documented fixed-budget zones on Home which use a 1.3 cap and `maxFontSizeMultiplier`).

## 3. Spacing, radii, surfaces
4-pt grid: 4 8 12 16 20 24 32. Screen gutter 20 (16 on SE width). 
Radii (all `borderCurve: 'continuous'`): chip/control/button 12 · row group/card 20 · feature card 24 · sheet 32 (top) · pill = full. Radii vary by role — no one-size card.
**Surface model:** depth = tonal step bg → s1 → s2 → s3 + 1px hairline. **No drop shadows** except the unavoidable system shadow of native sheets. Inset-grouped lists on s1; sheets on s2; selected/pressed on s3 or accentSoft. Blur only for: tab bar and sheets over the sky.

## 4. Iconography (SF Symbols via expo-symbols)
One weight (**regular**; **semibold** for active tab), `hierarchical` rendering for informational glyphs, `palette` (accent+secondary) only for the single key icon per screen. Fill variant = active/selected. Tint from tokens only. No emoji, no custom SVG icons except the existing celestial art and the Qibla instrument. Retained tabs: Athan `moon.stars` (fill active), Calendar `calendar`, Quran `book` (fill active), Qibla `location.north.circle`→ `safari` (fill active), Settings `gearshape`.

## 5. Tab bar (justification)
5 tabs kept: each is a distinct daily-use destination (prayer, date, Quran, direction, setup); merging would hide Qibla/Calendar. Native UITabBar retained (see Standing decisions); styled: tint = accent, unselected = textSecondary, bar background tinted toward bg, hairline top edge; selection haptic.

## 6. Motion
- Springs for state: `snappy {damping 22, stiffness 260, mass 1}`, `gentle {damping 26, stiffness 140}`; press-scale 0.97 on controls, 0.985 on rows, 120 ms.
- Durations: micro 120 · standard 240 · emphasis 420 · **sky crossfade 4 s** ease-in-out (stage boundary only).
- Entering: opacity + 8pt rise, staggered 40 ms, max 6 items; first launch, onboarding steps and sheet presentation only (never on tab switches).
- Sky: existing slow pulse/twinkle retained, nothing added. **Parallax rejected**: Home is no-scroll, device tilt needs a native sensor module (expo-sensors), and idle drift is a template tell. Crossfade is skipped (snap) when the app resumes from background across a stage change; Reduce Motion → 0.3 s.
- Reduce Motion: no parallax/pulse/stagger; crossfades become 0.3 s fades. Animations on native driver (`useNativeDriver: true`), no JS-driven per-frame loops.

## 7. Haptics map (expo-haptics)
Tab change / chip / segmented / toggle → `selectionAsync` · primary button & sheet open → `impact Light` · location set / settings saved → `notification Success` · permission denied / error → `notification Warning` · Qibla aligned → `impact Medium` once per entry (debounced) · scrolling, countdown ticks, text input → none.

## 8. Voice (copy)
Plain, specific, respectful. Sentence case. Names real things ("Fajr in 1 h 12 min", "Your location is off — choose a city instead"). No exclamation marks, no "Unlock/Supercharge/Seamless", no emoji. Arabic prayer names shown alongside Latin where space allows.

### Voice samples (before → after)
- Empty bookmarks: ~~"No bookmarks yet! Start reading!"~~ → "Nothing saved yet. Hold a page to keep your place."
- Location denied: ~~"Location access required"~~ → "Location is off, so times are for Mecca. Choose your city, or turn location on in Settings."
- Not found: "That page isn't here. Back to prayer times."
- Stale: "Showing times saved 2 days ago. They'll refresh when you're online."

## 9. States
Every data surface defines: skeleton (surface2 → surface3 low-contrast shimmer, 1.6 s), empty (one line of real copy + one action), error (what happened + retry), permission-denied (why we ask + Settings deep link). Loading never shows a spinner on Home — show last-known times. **Home states:** (1) normal; (2) *default location* (never resolved/denied): notice line under the date, "Times for Mecca · Choose your city", opens LocationSheet; (3) *stale cache* (>24 h): same slot, "Saved times · updated {n} days ago"; (4) *permission denied*: copy above + "Open Settings" deep link; (5) geocode failure in LocationSheet: inline error + retry. The `Syncing prayer times` branch is dead code (location is always seeded) and is replaced by state 2.

### Home Dynamic Type budget
Fixed-budget zones keep `NO_SCROLL_FONT_CAP` 1.3. Countdown: `numberOfLines={1}` + `adjustsFontSizeToFit` (min scale .6). Degradation order when height is short (SE, large type): (1) drop Arabic prayer names, (2) hide progress rule, (3) drop Hijri subline, (4) row height shrinks to a 36pt minimum. Past rows: muted time text + VoiceOver "passed" (not opacity alone).
**Home hierarchy:** countdown (hero) › next-prayer name + "at 3:42 PM" (title3/subhead) › list. Accent on Home = progress rule + the **next** prayer's row marker (3pt tick + skyWash). **The apricot row marker means "next prayer" on every surface** (Home, Calendar, in-app widgets, WidgetKit); the "Now · <prayer>" eyebrow names the current prayer; passed rows (including the current one) are dimmed. After Isha nothing is marked in the app (tomorrow's Fajr is not in today's list; WidgetKit's rolling list does mark it). Between midnight and Fajr the eyebrow reads "Overnight".
**Settings appearance note** (one line): "Home and Qibla always show the night sky; Appearance changes everything else."
**Tabs: decided** native `react-native-bottom-tabs`, token-styled; labels over the Dhuhr sky verified ≥4.5:1 in Phase 5.

## 10. Sky palette principles (Home hero: refine, don't redesign)
Stops authored in OKLCH, output hex, 6–8 stops/stage. Guard-rails (token validator enforces):
- Bottom stop of every stage converges to the ink family (L≈.20, C≤.04, h 295–305°), **including Isha** (cold navy `#070d18` is retired).
- **Hue travel:** adjacent stops differ ≤ 60° hue unless the step passes through low chroma (both stops C ≤ .045); total travel ≤ 200°. Dawn/dusk stages (fajr, sunrise, maghrib) may pass through a *muted* violet→rose (C ≤ .10, L ≤ .5) because that is what a real horizon does; saturated blue→violet→pink (neon) is never allowed. (Amended in 6b after art review: the earlier absolute ban contradicted the ramps the validator accepts; art-director to re-judge on device.) **Chroma ceiling** C ≤ .10 in the sky body, ≤ .13 only in the horizon band (warm band, lowest 25%).
- **Reads as a clock:** top-stop lightness spread between the brightest (Dhuhr) and darkest (Isha) stage ≥ 0.12 L. Dhuhr is a hazy dusty blue-grey, darker than before but still clearly the lightest; hero text keeps AA with the scrim.
- **Dither:** ship only after an on-device before/after on Isha/Fajr shows banding removed; 1–3% opacity monochrome PNG tile, static. If banding isn't visible, drop it.
- Crossfade 4 s once at stage boundary (see Motion).

## 11. Anti-AI checklist (PART 7) — enforced per screen
No neon purple→pink/blue→purple gradients · no gradient text · no glows on UI (celestial-body glow in the sky art is the one exception) · no sparkle motifs · blur only tab bar + sheets · varied card roles/radii · no emoji icons · Fraunces + SF pairing · no centered-hero-plus-3-cards · accent ≤ 1 primary use per screen region · no filler copy.
Pass criteria: a stranger shown a screenshot should not be able to say "template".

## 11b. Sky ramp construction
Ramps are authored as 8 OKLCH stops (0-3 sky, 4 pre-horizon, 5 horizon, 6 eased dissolve, 7 ink) and densified by `sync-tokens` with a Catmull-Rom spline in OKLCH (4 subdivisions per segment, 29 hex stops) so blends are perceptual and the horizon has no slope seam.

## 12. Panel record (Phase 2 gate)
Round 1: anti-ai-critic 7 APPROVE(cond) · art-director 7.5 REJECT · ux-strategist 7 REJECT. Round 2 amendments above address every MUST-FIX. Rejected ideas (revisit in decision round): surfaces hue-shifted per prayer stage (breaks native parity); countdown hue by stage (breaks accent budget); numeric badge on Athan tab (not on native bar without risk); parallax / idle drift.
