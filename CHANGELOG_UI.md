# CHANGELOG_UI.md

## Unreleased (`ui-refine`)
- Iter 3: Design tokens as single source of truth (`design/tokens.json`) with validator + generators (`npm run tokens`, `npm run tokens:check`). New `src/design/{tokens,theme}` (`useTheme`), `widgets/DesignTokens.swift`. Fraunces SemiBold loaded. Old `src/theme/*` and `ThemeContext` still in place until screens migrate (Phase 6); nothing user-visible changed yet.
- Iter 4: src/design primitives (Text, Button, Chip, ListRow, SegmentedControl, TextField, BottomSheet, Toast, Skeleton, EmptyState, ScreenContainer, ...). Not used by screens yet.
