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
