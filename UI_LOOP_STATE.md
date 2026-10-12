# UI_LOOP_STATE.md — loop memory (read first every iteration)

Branch: `ui-refine` · Baseline tag: `ui-baseline` (f2ff37e)

## Environment facts (verified iteration 0)
- Dev machine is **Windows**. No Xcode: an iOS build/simulator run is NOT possible locally. Verification here = `node node_modules/typescript/bin/tsc --noEmit` (baseline: clean) + prettier. iOS compile check happens via `.github/workflows/ios-build.yml` (macOS runner, workflow_dispatch) — needs the user to trigger/push. Never claim an iOS build passed unless CI actually ran.
- Managed/CNG Expo SDK 56 (no `/ios`, `/modules` committed). Native surface = `widgets/*.swift` (react-native-widget-extension plugin), app.json plugins/entitlements.
- No ESLint configured. Lint step = tsc + prettier --check on touched files.
- AGENTS.md: read versioned Expo docs (v56) before writing Expo code.
- Palette conflict: earlier memory says brand green #4FAE86 / app.json #315C46. This brief explicitly replaces it (ink #17121F + apricot accent). Brief wins; log in BRAND.md.
- App: AthanNow, prayer times (adhan), Qibla, Quran (mushaf), Hijri calendar, widgets, onboarding. Tabs via react-native-bottom-tabs (native UITabBar) + @callstack/liquid-glass.

## Phases
- [x] 0. Setup: branch, tag, 7 agents in `.claude/agents/`, this file
- [x] 1. AUDIT → `DESIGN_AUDIT.md`
- [x] 2. BRAND → `BRAND.md` (gate: art-director, anti-ai-critic, ux-strategist approve)
- [x] 3. SHARED DESIGN TOKENS (`design/tokens.json`, `src/design/tokens.ts`, ThemeProvider, `DesignTokens.swift`, `scripts/sync-tokens`)
- [x] 4. DESIGN SYSTEM (`src/design`)
- [x] 5. CUSTOM TAB BAR (decision: native bar restyled; custom floating bar rejected)
- [ ] 6. ALL SCREENS
  - [x] 6a Home sky refinement (OKLCH, dither PNG, slow crossfade, parallax, harmonise with ink)
  - [ ] 6b Home chrome  - [ ] 6c Calendar  - [ ] 6d Quran  - [ ] 6e Qibla
  - [ ] 6f Settings (+appearance toggle)  - [ ] 6g Onboarding  - [ ] 6h Sheets  - [ ] 6i Not-Found/empty/error/skeleton
- [ ] 7. IN-APP WIDGETS (`src/widgets`)
- [ ] 8. NATIVE iOS PARITY
  - [ ] 8a widget small  - [ ] 8b medium  - [ ] 8c large  - [ ] 8d accessories  - [ ] 8e tinted/clear/StandBy
  - [ ] 8f launch screen  - [ ] 8g app icon (propose)  - [ ] 8h tab bar tint  - [ ] 8i widget fonts (logged)  - [ ] 8j Live Activity proposal (doc only)
- [ ] 9. DESIGN DECISION ROUND
- [ ] 10. FINAL full-panel scoring → FINAL SUMMARY

## Standing decisions (do not relitigate)
- Avoid new native deps: use RN Animated, react-native-linear-gradient, react-native-svg, pre-rendered noise PNG. (reanimated/blur/skia not installed.)
- Keep native `react-native-bottom-tabs`; style it; Phase 5 evaluates a floating custom bar only if it carries no native risk (prior history: custom bar was reverted to native by user preference).
- No Live Activities/Dynamic Island exist; only propose.
- Sky crossfade: one slow crossfade at stage boundary, NOT the old continuous blend-toward-next (removed earlier by user feedback).

## Review backlog
- 6a follow-ups: (1) dither overlay deliberately NOT shipped; gate = on-device before/after on isha/fajr (OLED); add 2% noise PNG tile if banding visible. (2) SkyScene celestial art colours (#FFF6CC sun, #E7E3F8 moon, cloud/bird/star hexes) still literal; tokenise or document as art exception in 6a-b/decision round. (3) Verify crossfade + perf on older iPhone (4 gradients during 4s fade). (4) Sunrise/maghrib/asr horizons judged on preview PNG only (`node scripts/sky-preview.mjs out.png`), re-judge on device. (5) Parallax rejected (BRAND).
- CHECK on iOS 26 device: native tab bar glass over Home sky; apricot active tint legibility over translucent bar on the lightest (dhuhr) sky; in system Light mode the translucent bar may render light under the dark app (pre-existing; resolve with appearance work in 6f, e.g. set userInterfaceStyle per preference).
- SHOULD (6): Toast renders under native Modal so it is invisible over BottomSheet (host a toast inside the sheet or use the sheet's own inline error). Existing JS sheets (`components/Sheet.tsx`) to be replaced by `design/BottomSheet` in 6h.
- SHOULD: design system is untested on device (Windows): verify BottomSheet drag/detents, SegmentedControl thumb, PressableScale layout (Pressable flexGrow inside Animated.View) in first simulator pass; Fraunces tabular figures.
- SHOULD: bold idea (3pt apricot leading tick as shared 'selected marker' for rows/segments) - consider in decision round.
- MUST (6a): sky ramps are numbers-only so far; judge on-device/simulator renders (reviewer gave art 5 / motion 6 / anti-ai 5 on first ramps; ramps reworked after: horizon moved to stop 6, distinct per stage, validators added). Re-review with real screenshots in 6a. Renderer must match validator assumptions: evenly spaced stops, scrim alpha linear .05 -> scrimBottom.
- SHOULD: ThemeProvider has no persisted appearance preference (wire in 6f); `highContrast` starts false (brief flash); old `src/theme/*` + `context/ThemeContext` coexist with `src/design/theme` until each screen migrates, delete in 6/9; DTSky.stops fallback isha == currentStage fallback (ok).
- SHOULD (CI): `widgets/DesignTokens.swift` not compiled locally; run macOS workflow once before relying on it in Phase 8.
- SHOULD (Phase 3): token validator must confirm light-mode accent text + tertiary AA; verify Fraunces lining+tabular figures on device (fallback SF digits); sky stop authoring with hue/chroma caps; Home notice line needs height budget (fits degradation order).
- Note: `.claude/agents/*` are not hot-registered in a running session; panel is run as general-purpose agents that read the role file. (Restarting Claude Code would register them.)

## Iteration log
### Iter 0 — setup
- Created branch/tag, agents. tsc baseline clean. No panel run (no visual change).
### Iter 1 — Phase 1 audit
- Wrote DESIGN_AUDIT.md (inventory, hardcoded colours, parity gaps, sky anatomy, do-not-touch, decisions, sub-task seeds). Docs only; no code, so no panel run. tsc unchanged (clean).
- Next: Phase 2 BRAND.md (needs panel gate: art-director, anti-ai-critic, ux-strategist).
### Iter 2 — Phase 2 BRAND
- Wrote BRAND.md. Panel round 1: anti-ai 7 (approve cond.), art-director 7.5 REJECT, ux 7 REJECT. Fixed all MUST-FIX (OKLab-verified surface steps, accent budget, glyphQuiet scope, sky guard-rails, Fraunces static+fallback, Home DT budget, Home states+copy, appearance note, tab decision closed). Round 2: AD 8.5, UX 8, anti-ai 8.5 — all APPROVE.
- Rejected (logged in BRAND §12): per-stage surface tint, stage-hued countdown, tab badge, parallax/idle drift.
- Docs only; tsc unaffected. Next: Phase 3 tokens.
### Iter 3 — Phase 3 tokens
- Added design/tokens.json, scripts/sync-tokens.mjs (validator: WCAG AA for all text pairs x 4 variants, OKLab surface steps/hue, sky ink convergence/hue travel/chroma/mud/horizon distinctness/skyText AA), generated src/design/tokens.generated.ts + widgets/DesignTokens.swift, src/design/{tokens,theme}.ts(x), Fraunces loaded in App.tsx, `npm run tokens[:check]`. NATIVE_CHANGES.md + CHANGELOG_UI.md created.
- Decision: dynamic Swift UIColor trait provider instead of .xcassets colour sets (equivalent light/dark/Increase-Contrast, no asset wiring).
- Validator caught real problems (light glyphQuiet 2.7:1, horizon text contrast); fixed. Sky ramps retuned after review (see backlog).
- Panel: native-safety-guard PASS 9/10; tokens review art 5 / motion 6 / anti-ai 5 on first ramps -> fixed MUST-FIX 1-5 (asr mud, dhuhr hue drift/lightness, sunrise gold, validators, ink-vs-bg check); not re-scored since visual verification isn't possible until 6a.
- tsc clean. No user-visible change yet.
### Iter 4 - Phase 4 design system
- Built src/design: Text, PressableScale, Surface/Card, Divider, Button, IconButton, Chip, Badge, Avatar, SectionHeader/ListGroup/ListRow, Toggle (native UISwitch), SegmentedControl, TextField/SearchBar, BottomSheet (detents, a11y actions), Toast, Skeleton, EmptyState/ErrorState, ScreenContainer, haptics map; barrel index.ts. Zero hardcoded colours; no new native deps (RN Animated native driver).
- Panel round 1: HIG 6, motion 6.5, anti-ai 6.5, art 7. Fixed: EmptyState unreachable button, iOS a11y announcements (live regions are Android-only), BottomSheet clipped content/stale closures/a11y actions/modal escape, Button pressed feedback + loading width, Segmented first-layout slide + 44pt, press timing 120ms, row scale removed, field focus without accent ring, chip pill + marker dot (no accent border), toast marker dot, required (non-generic) copy for EmptyState/ErrorState/SearchBar, display font Dynamic Type cap 1.3, 16pt gutter on SE width.
- Not yet re-scored (code-only review; visual judgement deferred to first screens in Phase 6). tsc + tokens:check clean.
### Iter 5 - Phase 5 tab bar
- Decision: keep native UITabBar. The library's custom `tabBar` slot renders in layout flow with no hit-testing outside bounds -> a floating bar over the sky would shrink screens and lose native iOS 26 glass; also previously reverted by user preference. Styled with tokens: accent active tint, textSecondary inactive, SF symbol fill on focus, native selection haptic; removed Android indicator/old green/near-black hex; splash + primaryColor -> #17121F (logged).
- Panel: native-safety PASS, HIG 8/10. Fixed warning (solid tabBarStyle would flatten the glass) by removing it.
- Next: 6a Home sky refinement.
### Iter 6 - 6a Home sky
- Old `prayerGradients`/`prayerStatusBarLight`/`gradientShiftMinutes`/`NIGHT_BG`/sky text now derive from tokens (colors.ts), so Athan, onboarding and widget preview all share the new ramps. AthanScreen scrim from per-stage token.
- AmbientGradient rewritten: vertical ramp + 30% opposing diagonal, single 4s crossfade at stage change via stacked layers (no jump if a change lands mid-fade), snap within 2.5s of foreground resume, 0.3s under Reduce Motion, cleanup on unmount.
- Ramps restructured (0-3 sky, 4 pre-horizon, 5 horizon, 6 eased dissolve, 7 ink): fixes the ink 'shelf', distinct sunrise (gold) vs maghrib (deep red), asr mud routed via lavender/rose, isha lifted to ink hue. Added `scripts/sky-preview.mjs` (renders ramps to PNG; panel reviewed the actual render).
- Panel: art 7, motion 6.5, anti-ai 8 on first pass -> all MUST-FIX addressed (crossfade jump, unmount cleanup, resume race, ramp twins, asr mud, isha cold navy, ink shelf). Not re-scored; will be re-judged with 6b on the full screen.
- tsc + tokens:check clean.
