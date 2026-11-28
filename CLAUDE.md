@AGENTS.md

# UI rules

These are strict. Every screen, component and SwiftUI view follows them.

## Tokens: one source of truth
- All colours, spacing, radii, type and fixed palettes come from `design/tokens.json`. After editing it, run `node scripts/sync-tokens.mjs`: it checks contrast and generates `src/design/tokens.generated.ts`, `widgets/DesignTokens.swift` and `modules/quran-reader/ios/Theme.swift`. Never edit the generated files by hand.
- React Native: import tokens from `src/theme/theme.ts` (`space`, `radius`, `type`, `palette`, `colors`, `arabicStyle`, `TOUCH_TARGET`), and use `useTheme()` for colours that follow light or dark mode (`t.c.*`, `t.spacing.*`, `t.radii.*`).
- SwiftUI in the Quran reader: use `Theme` (`Theme.Space`, `Theme.Radius`, `Theme.Size`, `Theme.Arabic`, `Theme.Reader`, `Theme.Page`). Widgets use `DTColor`, `DTSpacing`, `DTRadius`, `DTFont`.
- Never hardcode a hex or rgba colour, a font size, a spacing number or a corner radius. Spacing follows the 4 point rhythm (`xxs` 2, `xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32, `huge` 48, `giant` 64). Circles and capsules use `radius.pill`. Sizes derived from the page geometry in the reader (a fraction of the text size) are the one exception.
- Arabic is always set in the mushaf's KFGQPC Hafs: `arabicStyle('caption' | 'small' | 'name' | 'ayah' | 'ayahLarge')` in React Native, `Theme.Arabic` in SwiftUI.

## Components: reuse, don't restyle
- Use the shared components in `src/design/` and `src/components/`: `Text` (type variants), `Button`, `IconButton` and `RoundIcon`, `Card` and `Caption`, `ListGroup` and `ListRow`, `SegmentedControl`, `Toggle`, `Sheet` (with `SheetHeader`, `SheetTitle`, `SheetSearchField`), `NativeMenu`, `PressableScale`. Extend one of these rather than writing a one-off.
- Every sheet uses `Sheet` or `SheetHeader`: the same grabber, a title in the display face at the left, a round close at the right, the same spacing.

## Look
- Flat and quiet. No gradients for decoration (the reader's edge fade is functional), no glows, no drop shadows, no 1 point borders around containers: separate with surface contrast or a hairline (`StyleSheet.hairlineWidth`).
- No emoji as icons, ever: SF Symbols (`expo-symbols` in React Native, `Image(systemName:)` in SwiftUI).
- No pills or chips stacked around plain controls; prefer the glyph or the word on its own.
- No em dashes or middle dots in copy.

## Touch, layout and copy
- Every control is at least 44 by 44 points to tap (`TOUCH_TARGET`; `IconTarget` for round icons, `hitSlop` where the visible shape is smaller).
- Respect the safe areas (`useSafeAreaInsets`), and leave room for the tab bar.
- Copy is short and natural, never robotic ("Submit", "No data found", "Something went wrong"). Every screen that loads handles loading, empty and error states, with a way to try again where it makes sense.
