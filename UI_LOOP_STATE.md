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
  - [x] 6b Home chrome  - [x] 6c Calendar  - [x] 6d Quran (screen chrome + palettes; Quran sheets finish in 6h)  - [x] 6e Qibla
  - [x] 6f Settings (+appearance toggle)  - [ ] 6g Onboarding  - [x] 6h Sheets  - [ ] 6i Not-Found/empty/error/skeleton
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
- 6g MUST (from bridge review): legacy `type`/`radii` now derive from design tokens app-wide (body 17/24, subhead 15/20, title1 30 Fraunces, hero 64 Fraunces, radii 12/20). Onboarding cards are absolutely positioned with no ScrollView: verify/fix fit of WidgetStep, CalcMethodStep (maxHeight 200 list), PermissionStep at 320/375pt + Dynamic Type; OutroStep title1 wrapping; IntroStep wordmark now fits via adjustsFontSizeToFit. Spotlight tooltip may be off the legacy scale (check).
- 6h-2 TODO (sheets styling, panel scored art 6 / anti-ai 5): remove icon-badge circles (LocationSheet:245, BookmarkSheet:71), sentence-case the uppercase tracked labels (LocationSheet:120, SurahHeader:58), move raw fontSize/weight/radius in SurahPickerSheet/BookmarkSheet/SurahHeader onto design type/radii tokens, number badge -> rounded square, lighter Sheet title weight (title2 800 is heavy), drop SurahHeader decorative accent dot, PRESSED_OPACITY literal; consider design Text/ListRow inside the native pageSheet.
- Then 6g onboarding: OnboardingBeacon:195, ProgressBar:69, CalcMethodStep:79,112 are the LAST importers of ACCENT; after migrating them delete ACCENT/ACCENT_SOFT/ACCENT_BORDER/ACCENT_ON_DARK/ERROR/STATE_SUCCESS from theme/colors.ts.
- ~~6h MUST (first thing)~~ DONE in iter 12 (accent/danger now palette-driven; verified contrast dark/light/paper): with Appearance=Light, unmigrated sheets still use the old green `ACCENT`/`ACCENT_SOFT` constants and are weak/clashing: LocationSheet:119,128,158,192,221 (opens over always-night Home), SurahPickerSheet:124-125,161,175,182,218, BookmarkSheet:48, SurahHeader:40, OnboardingBeacon/ProgressBar/CalcMethodStep on sky. Replace with `useTheme().colors.accent` / design tokens or the design BottomSheet; then delete ACCENT*, ERROR, STATE_SUCCESS from theme/colors.ts. Default appearance is Dark, so no regression by default.
- 6f: verify on device: Appearance.setColorScheme('unspecified') follows system; native tab bar / keyboard over always-night Home & Qibla in Light; BottomSheet lower-detent content reachable; toggle rows read label twice (title + labelled switch) - consider merging.
- 6e: verify on device: aligned transition (colour interpolation is JS-driven, border width animates), dial scale on SE width, lubber red->apricot legibility (danger #E08A8A is salmon, close to apricot in hue), crosshair at 8% hairline nearly invisible (keep or remove), 12pt degree numbers. Bold idea (not built): apricot arc sweep from the lubber on lock + 'Facing the Qibla' caption in place of the cardinal.
- 6h MUST include Quran sheets: SurahPickerSheet (green ACCENT :124,159,173, '#FFF' on accent), BookmarkSheet:47, SurahHeader:40 still use old green ACCENT/ACCENT_SOFT on paper; replace with paper accentText / design tokens. Then delete ACCENT/ACCENT_SOFT/ACCENT_BORDER/ACCENT_ON_DARK/ERROR/STATE_SUCCESS from theme/colors.ts once Settings (6f), Qibla (6e), Onboarding (6g) migrate.
- Legacy `darkPalette.accent` is now apricot: any future `#FFF` text on `colors.accent` fails contrast; use `onAccent` (#17121F).
- 6c: Calendar day rows are 400 near-identical blocks; mitigated by dropping Arabic on non-today days. Bold idea (not built): non-today days as one quiet inset-grouped surface1 card, full treatment only for Today. Revisit in decision round.
- 6c: LocationSheet no longer reachable from Calendar (dead branch removed; location is always seeded). Location is changed from Home.
- 6c: getItemLayout ignores contentContainer padding (as in baseline; error now 4pt vs ~67pt).
- 6b: stale-cache Home state NOT built (needs a saved-at timestamp the app does not store; would be a data-layer change). Revisit in decision round.
- 6b: verify on device: Fraunces `adjustsFontSizeToFit` hero, SE-height budget with notice shown (667pt), tabular figures in Fraunces (fallback: SF digits), Mach-band seam near 72% of sky.
- 6b: art-director flagged hue travel in fajr/sunrise/asr as 'template gradient'; resolved by documented amendment (muted violet->rose allowed at dawn/dusk). Re-judge on device.
- 6b bold idea (not built): progress rule as a full-width 1pt line with an apricot segment tying hero to the current row tick.
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
### Iter 7 - 6b Home chrome
- AthanScreen render rewritten with design tokens (no hardcoded rgba): Fraunces 64pt hero countdown (fit-to-width, timer role, grouped VoiceOver label), eyebrow 'Now - <prayer>', subline 'until X - time', apricot progress rule (only filled accent), rows on sky with current row = 3pt apricot tick + 8% wash, hairlines, degradation order (Arabic -> progress -> Hijri -> row height), notice line (location off/error) with Settings deep link + 'choose city' accessibility action. New tokens skyFill/skyHairline/skyWash; FloatingControl onSky uses them.
- useLocation: one-line display-state change: cold start with *denied* permission now sets status 'denied' (no prompt, no location change) so the notice is reachable.
- Sky ramps now densified in OKLCH by Catmull-Rom spline (29 stops) in sync-tokens: smoother horizon, no sRGB mud.
- Panel: art 7.5, anti-ai 8, ux 7, HIG 6.5 -> fixed: unreachable notice, copy/action mismatch, SE overflow (notice displaces Hijri), hero VO redundancy, list role, stale SKY_STRIP height, weight/italic/track tweaks. BRAND amended (hue travel, sky fills). Not re-scored; on-device check pending.
### Iter 8 - 6c Calendar
- CalendarScreen visuals rebuilt on design system: opaque header (Fraunces 'Calendar' + secondary Today button, replaces floating pill + SafeAreaScrim), token colours, Badge (Today = accent, occasion = info), rows with accentSoft wash + 3pt tick for next prayer, Arabic names only on today. Scroll/measure/getItemLayout/onStartReached logic untouched (reviewer diffed vs baseline: equivalent). Removed unreachable empty state + LocationSheet. Old IMPORTANT_TINT gold/ACCENT green removed. Status bar follows scheme. Added Badge `info` tone.
- Panel: art 6.5, anti-ai 7, UX 7.5, HIG 7 -> fixed accent budget (icon tint), wash token, DT wrapping/shrink, header a11y landmark, tabular numerals, tick inset, status bar by scheme. Not re-scored.
### Iter 9 - 6d Quran chrome
- Legacy `darkPalette` and `readingPalette` now derive from design tokens (bridge), so unmigrated screens/sheets already pick up ink/paper colours. Paper token set completed (textTertiary, glyphQuiet, accent, band, mark) and validated for AA in sync-tokens. Mushaf band/mark and reader highlight tints from tokens. QuranScreen: VoiceOver header + button labels, type tokens, fallback fills from palette, continuous 12pt corners; dead retry styles removed. Liquid-glass usage, AsyncStorage keys, mushaf/quran logic untouched.
- Panel (combined): art 8, HIG 7.5, native-safety 9.5, no MUST-FIX.
### Iter 10 - 6e Qibla
- QiblaScreen rebuilt on tokens (always-night: reads dark tokens directly): ink bg, hairline dial, skyText cardinal ticks, muted-red north (danger), Fraunces 64pt readout (fit-to-width), plain skyText Qibla dot that turns apricot on lock with a 240ms transition (colour + ring weight + dot spring; Reduce Motion aware); halo/glow and stock green/red removed. States: denied/error now explains and offers Open Settings; compass-unavailable/calibrating copy rewritten. VoiceOver: static 'Qibla compass' label + value, 'Facing the Qibla' announcement. useQibla/sensor logic untouched.
- Behaviour fixes from review: lock only counts when calibrated, compass present and tab focused; 1.5s cooldown; haptic per BRAND map (impact Medium, was notification Success); warning haptic on error; ScrollView for large Dynamic Type; dial scales down on narrow screens.
- Panel: art 7.5, anti-ai 8.5, UX 8, HIG 7 -> MUST-FIX items addressed; not re-scored.
### Iter 11 - 6f Settings + Appearance
- SettingsScreen rebuilt on design system (ScreenContainer, SectionHeader/ListGroup/ListRow, native Toggle, SegmentedControl, design BottomSheet pickers); every prior setting/handler preserved. New Appearance control (System/Light/Dark) stored as additive `appearance` field in the existing settings blob (default 'dark'; reset restores it). App.tsx `AppThemes` feeds the preference to the design ThemeProvider and `Appearance.setColorScheme` (JS API, no native change) so tab bar/keyboard/alerts follow. Legacy ThemeContext now follows scheme (lightPalette added). Deleted settings/SettingsRows.tsx. Footer note: 'Home and Qibla always show the night sky. Appearance changes everything else.'
- ListRow gained `selected`/`expanded` a11y state. Panel: UX 8, HIG 7, native-safety 9, art 7.5; MUST-FIX 1 (a11y state) fixed; MUST-FIX 2 (green accent in sheets under Light) moved to 6h as first task, since those files are 6h scope.
### Iter 12 - 6h part 1 (sheet colours)
- Legacy Palette gained accentSoft/onAccent/danger (+ accent is now the text-safe accent per surface family); new tokens onAccentText (dark ink / white on deep accent), paper.accentSoft/danger, validated for AA in sync-tokens. LocationSheet, SurahPickerSheet, BookmarkSheet, SurahHeader no longer use old green ACCENT/ERROR; they follow dark/light/paper. Contrast verified by reviewer for all three palettes.
- Panel: art 6, HIG 7, anti-ai 5 (styling leftovers: badges, uppercase labels, raw type; logged as 6h-2). 6h stays unchecked until 6h-2 is done.
### Iter 13 - 6h part 2 (sheet styling + legacy scale bridge)
- Sheets: icon-badge circles removed (LocationSheet, BookmarkSheet), sentence-case labels, SurahHeader meta sentence-case + decorative dot dropped, rounded-square surah number badge, tokens for type/radii, lighter sheet title (title3), labelled remove-bookmark button, real empty copy. LocationSheet input lineHeight fix.
- Global: src/theme/typography.ts and radii.ts now derive from design/tokens (single source), so every legacy consumer inherits the new scale/Fraunces display; IntroStep wordmark made fit-to-width.
- Panel: art 7, anti-ai 8, HIG 6.5 -> MUST-FIX 1-3 done; onboarding fit risk moved to 6g. 6h ticked.
