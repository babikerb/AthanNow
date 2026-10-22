# AthanNow redesign plan (Oct 2026)

Merged from the art-director and ux-strategist proposals, plus an Ayah (iOS) review of the Quran screen.
Status column: [ ] todo, [x] done.

**Brand ruling:** the UI stays ink #17121F + apricot #E8B07A (BRAND.md). The reference's sage green appears only in the Asr illustration palette, never as a UI accent.

## 1. Sky scene: "scene band + ink ground"
- [ ] New `src/components/sky/` SVG illustration (react-native-svg) in the reference style: gradient sky, static stars, a celestial body in a fixed lane, 3 ridges (atmospheric perspective), and one mosque skyline (main dome + 2 minarets in the right third, lower dome and arcade on the left). Nearest layer filled with #17121F so it melts into the UI.
- [ ] 7 palettes: Fajr, Sunrise, Dhuhr, Asr (sage), Maghrib (large setting sun behind the minarets), Isha, Night.
- [ ] The scene owns the top `clamp(0.40*H, 240, 360)`. Only the location pill and date chrome sit inside it. No text crosses the sky, so the scrim goes.
- [ ] Remove glows, pill clouds, arc travel and twinkle. A 4s crossfade at period boundaries (300ms with Reduce Motion), snap on resume.

## 2. Home hierarchy
- [ ] Hero below the skyline, left-aligned: "Asr" + "at 3:42 PM", 64pt Fraunces countdown, hairline progress rule with an apricot elapsed segment. Drop the "NOW · DHUHR" eyebrow.
- [ ] Rows: the next prayer gets a tick + emphasis, with no wash pill.
- [ ] Countdown never shows 00m 00s.
- [ ] Notice uses two visible text buttons (no hidden long-press).

## 3. Location (industry standard)
- [ ] Don't throw away an offline GPS fix (reverse geocode guarded).
- [ ] Search distinguishes an offline error from "no results".
- [ ] Sheet: search pinned at the top; Current location row with granted / undetermined / denied (Settings button) / loading / error states; Recents (5, offline, Edit to remove); suggestions replace the sections while typing.
- [ ] Pill: GPS shows the arrow glyph, a manual city shows plain text, "Locating…" before the first fix.
- [ ] Travel: refresh GPS on foreground if older than 30 min; timezone mismatch prompt "Your phone is on X time…".
- [ ] Device-language search; name/region stored separately.
- [ ] Settings gets a Location row. Qibla error opens the LocationSheet in place.
- [ ] Honest privacy and usage copy; onboarding re-checks permission on foreground; copy fixes.

## 4. De-vibe-coding
- [ ] One spacing scale (delete the conflicting `src/theme/spacing.ts` values); fix off-grid literals.
- [ ] Remove the `eyebrow` uppercase variant, tracked caps, inline fontWeights.
- [ ] Remove glass outside the tab bar and sheets, glows, and accent-on-decoration; replace Calendar badges with footnote text.
- [ ] Delete dead components and changelog-style comments.
- [ ] Settings: drop row icons except the notification status row; rewrite filler copy.
- [ ] Calendar: sticky month header, grouped day cards. Qibla: left-aligned info block, plain "Northeast".

## 5. Quran (Ayah-style)
- [ ] Offline pages: expo-image disk cache + neighbour prefetch + "Download all pages".
- [ ] Immersive: tap the page to hide/show the header, footer and native tab bar.
- [ ] Footer: solid paper bar, one icon style, no glass.
- [ ] Coloured multi-bookmarks (5 colours), grouped list.
- [ ] Retry on a failed page actually reloads.
- [ ] Later (needs ayah coordinate data + an audio lib): verse tap-select, recitation with highlighting.

## Out of scope / flagged
- Widgets adopting the scene (pre-rendered PNGs, needs a CI-verified pass).
- Open-Meteo is free for non-commercial use only; check licensing before a paid launch.
