# CHANGELOG_UI.md

## Unreleased (`ui-refine`)
- Iter 3: Design tokens as single source of truth (`design/tokens.json`) with validator + generators (`npm run tokens`, `npm run tokens:check`). New `src/design/{tokens,theme}` (`useTheme`), `widgets/DesignTokens.swift`. Fraunces SemiBold loaded. Old `src/theme/*` and `ThemeContext` still in place until screens migrate (Phase 6); nothing user-visible changed yet.
- Iter 4: src/design primitives (Text, Button, Chip, ListRow, SegmentedControl, TextField, BottomSheet, Toast, Skeleton, EmptyState, ScreenContainer, ...). Not used by screens yet.
- Iter 5: tab bar tinted from tokens (accent active, fill icons, native haptic); splash/primaryColor -> ink #17121F.
- Iter 6: Home sky uses token ramps (OKLCH-authored), single 4s stage crossfade, ink-converging horizon; sky text/night bg from tokens.
- Iter 7: Home chrome restyled (Fraunces hero, apricot progress rule + row tick, token sky fills, location/denied notice); sky ramps spline-densified.
- Iter 8: Calendar restyled (header + Today button, badges, tokens).
- Iter 9: Quran screen chrome + paper palette; legacy palettes bridged to tokens.
- Iter 10: Qibla rebuilt (no glow, apricot lock transition, states).
- Iter 11: Settings rebuilt on design system; Appearance (System/Light/Dark) added and wired to theme + native window scheme.
- Iter 12: sheets use palette-driven accent/danger (dark/light/paper).
- Iter 13: sheet styling cleanup; legacy type/radii derive from tokens.
- Iter 14: onboarding on tokens, legacy accent/error constants removed, zero hex literals outside tokens.
- Iter 15: in-app widgets (src/widgets) small/medium/large as WidgetKit reference; onboarding preview uses them.
- Iter 16: WidgetKit widgets restyled to match in-app widgets (system serif numerals; Fraunces not bundleable).
- Iter 17: app icon recoloured (apricot on ink) with dark/tinted variants; Live Activity proposal documented.
- R1: shared LocationProvider; Home/Qibla unresolved-location notices.
- R2: Settings notification status row; schedule mutations serialised.
- R3: notification copy in brand voice (times in titles).
- R4: next-prayer marker on every surface.
- R5: 44pt location pill, keyboard-aware LocationSheet, BottomSheet window/keyboard handling.
- R6: smoother sky ramps, dither tile, art crossfades with sky, no birds/rays.
- R7: Home scrolls at large text sizes; hero/rows VoiceOver reworked.
- R8: Qibla rose memoised; aligned state fully native-driver.
- R9: quieter Home/Calendar/Settings rows.
- R10: single native sheet system, haptics via design map.
