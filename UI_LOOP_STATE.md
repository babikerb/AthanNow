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
- [x] 6. ALL SCREENS
  - [x] 6a Home sky refinement (OKLCH, dither PNG, slow crossfade, parallax, harmonise with ink)
  - [x] 6b Home chrome  - [x] 6c Calendar  - [x] 6d Quran (screen chrome + palettes; Quran sheets finish in 6h)  - [x] 6e Qibla
  - [x] 6f Settings (+appearance toggle)  - [x] 6g Onboarding  - [x] 6h Sheets  - [x] 6i Not-Found/empty/error/skeleton (Not-Found skipped: see note)
- [x] 7. IN-APP WIDGETS (`src/widgets`)
- [x] 8. NATIVE iOS PARITY
  - [x] 8a widget small  - [x] 8b medium  - [x] 8c large  - [x] 8d accessories (copy only; system-tinted by design)  - [x] 8e tinted/clear/StandBy (widgetAccentable on tick/rule/background via containerBackground; no StandBy-specific layout)
  - [x] 8f launch screen  - [x] 8g app icon  - [x] 8h tab bar tint  - [x] 8i widget fonts (decision: system serif, logged; upgrade path in NATIVE_CHANGES #7)  - [x] 8j Live Activity proposal (doc only)
- [x] 9. DESIGN DECISION ROUND
- [ ] 10. FINAL full-panel scoring → FINAL SUMMARY

## Standing decisions (do not relitigate)
- Avoid new native deps: use RN Animated, react-native-linear-gradient, react-native-svg, pre-rendered noise PNG. (reanimated/blur/skia not installed.)
- Keep native `react-native-bottom-tabs`; style it; Phase 5 evaluates a floating custom bar only if it carries no native risk (prior history: custom bar was reverted to native by user preference).
- No Live Activities/Dynamic Island exist; only propose.
- Sky crossfade: one slow crossfade at stage boundary, NOT the old continuous blend-toward-next (removed earlier by user feedback).

## REFINEMENT PLAN (Phase 9 output; work one per iteration, tick when done)
Panel scores at Phase 9 (baseline for Phase 10): art 7 - ux 6 - HIG 6.5 - motion 7 - native-parity 7 - native-safety 9 PASS - anti-ai 8. Stop condition needs every reviewer >= 8 and zero MUST-FIX.
- [ ] **R1 (M) One shared location state.** `useLocation` is per-instance (Athan, Qibla, Calendar, Settings, widgets/model, Onboarding): city changes on Home leave other tabs stale. Introduce a `LocationProvider` (same storage key/shape, same restore/refresh semantics) and make the hook read it; show the Home notice when `!isManual && status !== 'ready'` (never silently Mecca); delete the dead 'Working out today's prayer times' branch. Accept: change city on Home -> Calendar/Qibla/Settings/widget preview update without relaunch. Check Qibla `status==='denied'` at cold start.
- [ ] **R2 (M) Notification trust.** Settings status row for notification permission (read-only check via existing expo-notifications API; 'Open Settings' when denied) + 'Scheduled through <date>' line (cap ~60 => ~5 days). No scheduling-logic change. Accept: denied permission is visible and recoverable from Settings.
- [ ] **R3 (S) Notification copy.** notifications.ts COPY ONLY: clock time in title ('Fajr - 5:12'), fix 'in 1 minutes', '(Fajr ends)', comma splice, Quran morning text, sound consistency. Do NOT change schedule times/ids (business logic); flag the 'Good morning fires with Sunrise' overlap in NATIVE/UI notes instead.
- [ ] **R4 (S/M) One meaning for the apricot marker: NEXT prayer** on Home, Calendar and widgets (widgets/Swift already NEXT). Home eyebrow keeps 'Now - X'. Accept: all surfaces tick the same prayer at any moment.
- [ ] **R5 (M) Location pill + sheet usability.** Home pill >= 44pt hit area; LocationSheet body scrollable + keyboard-aware; design BottomSheet via useWindowDimensions + keyboard inset. Accept: suggestions visible with keyboard open on SE.
- [ ] **R6 (M) Sky polish (biggest premium lever; art-director ruling).** Fix ramp seams (~75%) in fajr/asr/maghrib, muddy sunrise lower band, teal asr top (tokens); static noise dither tile under the scrim (once, above skies); SkyScene art fades with the same value as the 4s gradient crossfade (no hard cut); remove birds + rays, simplify clouds, static glow; cap AmbientGradient stack at 2 layers. Verify with scripts/sky-preview.mjs.
- [ ] **R7 (M) Home accessibility / Dynamic Type.** Allow scroll at fontScale >= 1.3 instead of capping text; row accessibilityRole/label/value; hero timer separate accessible element.
- [ ] **R8 (M) Qibla performance.** Memoize the 72-tick rose (re-render only the readout on heading change); constant border width + native-driver opacity overlays (no useNativeDriver:false left in Qibla).
- [ ] **R9 (S/M) Noise reduction.** Drop Home row SF icons (label + Arabic + time), de-duplicate Settings glyphs (bell x6, sunrise x2), Calendar non-today days as quiet cards, raw type in Qibla/Mushaf onto type tokens.
- [ ] **R10 (M) Delete the legacy parallel system.** Migrate LocationSheet/SurahPickerSheet/BookmarkSheet off components/Sheet.tsx + components/IconButton.tsx (pick ONE sheet system), route raw expo-haptics calls through design/haptics, delete the legacy files.
- Housekeeping (zero risk, do inside any iteration): NATIVE_CHANGES.md 'Verified unchanged (as of iter 3)' header -> iter 16; amend BRAND section 5 (tab bar has no hairline/tint, kept native glass); BRAND note that widgets use system serif.
- Opportunistic (fold in while touching the file): BottomSheet release velocity/tokens, shared 1s clock, shared skeleton value, theme.reduceMotion initial value, Dimensions at module scope (AthanScreen, SkyScene), status bar per screen in Light, hardcoded radii outside design, mushaf load-error retry action, onboarding copy trims (steps.ts:52, Outro repeats itself), Settings expander chevron.
- Deferred (not doing, with reason): typed-word icon redesign (needs art + device); icon bg mottling (asset re-export); Swift polish (padding double-inset, empty-state copy, group-widget stale guard, hero sizes, Fraunces, accessory gauge, StandBy, hardcoded numbers, VoiceOver labels): cannot compile/verify here, batch for a macOS-CI-verified pass; Live Activity: needs explicit go-ahead (touches bridge contract).

## Review backlog
- 8 (Swift) is NOT compiled locally: the macOS CI workflow (workflow_dispatch `iOS Build`) must be run before trusting it. Reviewer acting as compiler found no errors; protected contract byte-identical to baseline.
- 8 SHOULD (open): Medium/Large hero sizes 30/48 vs reference 32/52 (system serif is wider than Fraunces; keep unless CI render shows room); ProgressView track colour is the system default (cannot set a hairline track in .linear style without a custom bar); verify Text(date, style: .timer) alignment and 13pt Medium rows (6x18+5x5=133 of 138pt) on a real device/Xcode canvas.
- 8 TODO remaining: 8f launch screen (app.json splash backgroundColor already ink; splash image still old green icon), 8g app icon (propose only: needs art), 8h tab bar tint (done in Phase 5), 8j Live Activity proposal (docs). Then Phase 9 decision round.
- 6i note: NO Not-Found screen: the navigator is a fixed set of five native tabs with no linking config, so no unmatched route is reachable (adding one would be dead UI). Remaining spinners (Quran restore, mushaf page image load, location suggestions, surah search) are short-lived system indicators; Quran/mushaf sit on the paper palette where the dark-scheme Skeleton does not apply. EmptyState/ErrorState exist in design for future use (Calendar/Home empty branches were dead code and removed).
- Phase 8 (Swift) MUST mirror src/widgets: sizes 170/364x170/382 @393pt (and 158/338x158/354 @390pt: WidgetKit supplies real size, use proportions), radius via containerBackground, padding 16, Fraunces numeral (bundle font + UIAppFonts, logged), next-prayer emphasis (bold + 3pt apricot tick), passed rows dimmed, apricot only on progress rule + tick, dense sky ramp from DTSky, scrim; tinted/clear modes via widgetAccentable/containerBackground; countdown = Text(date, style: .timer) with fixed frame; progress rule = ProgressView(timerInterval:) or stepped. Interactive press/long-press menus are NOT possible for in-app reference previews and WidgetKit widgets are non-interactive (App Intents out of scope).
- 6g follow-ups: hero steps (Intro/Outro) not scrollable (verify at AX Dynamic Type); card scroll has no visible hint (bounces off, indicator off) so on small phones the CalcMethod list may hide Continue; SkyScene sun glow/rays/radial halos are the most 'AI sunset' element left (art, kept: scene concept preserved); consider skyWash for ProgressBar track; import order (colorTokens above react) lint nit.
- ZERO hex/rgba literals remain in src/ and App.tsx outside src/design + tokens.generated (verified by grep, iter 14). app.json has the two ink values (logged).
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
### Iter 14 - 6g Onboarding + legacy colour cleanup
- Onboarding on tokens (skyText/skyHairline/skyWash/accent/onAccent): primary CTA apricot fill + ink text, card shadow removed, card in a ScrollView (flexGrow 0) so tall steps scroll; selected state a11y on method options; copy rewritten to BRAND voice (Qibla step no longer claims green; permission/outro/info lines).
- Deleted legacy ACCENT/ACCENT_SOFT/ACCENT_BORDER/ACCENT_ON_DARK/ERROR/STATE_SUCCESS and theme/shadow.ts; IconButton default tint, AmbientGradient scrim and SkyScene celestial art colours moved to tokens (skyArt, scrimBase). Flow/permissions/context logic untouched (reviewer diffed).
- Panel: UX 7.5, HIG 8, art 8, anti-ai 8.5; MUST-FIX (Qibla green claim) fixed.
### Iter 15 - 6i + Phase 7 in-app widgets
- 6i: documented Not-Found as unreachable; sheet error/empty copy tuned.
- src/widgets: model.ts (useWidgetModel: gated on restored location, heavy day compute memoised, 1s tick only for countdown/progress/flags), WidgetFrame (exact iOS sizes, radius 22, padding 16, sky ramp + stage scrim, mount fade), Small/Medium/Large widgets (Fraunces numeral countdown, next-prayer tick, apricot progress rule, tabular times, fixed geometry), onboarding WidgetPreview now renders the real Medium widget at thumbnail scale. Header comment lists what WidgetKit cannot do.
- Panel: art 7, native-parity 5, anti-ai 8, HIG 6 -> fixed: 393pt sizes, medium column overflow (133 of 138pt), emphasis switched to NEXT (parity with Swift), passed rows dimmed (.62), model perf, rule animation once, reserved rule height, allowFontScaling off, preview gating. Not re-scored.
### Iter 16 - Phase 8a-8e,8i native widgets
- widgets/AthanWidget.swift presentation rewrite mirroring src/widgets (DTSky ramp + scrim, DTNight colours, system-serif tabular countdown, next-prayer tick, apricot progress rule via ProgressView(timerInterval:), Arabic names on Large, sentence-case accessory copy, text shadow removed). Protected data/timeline/widget-config code unchanged (verified). Generator added DTNight, DTSky.scrim, serif DTFont.display. Fraunces cannot be bundled with the current plugin (only .xcassets reach Resources): system serif used, logged (NATIVE_CHANGES #5-7).
- Panel: native-safety PASS, parity 8/10, no MUST-FIX; SHOULD-FIX applied (timer alignment, reserved rule height, Large gap, Medium row size).
### Iter 17 - Phase 8 remainder (icon, launch, Live Activity doc)
- App icon recoloured to ink + apricot with light/dark/tinted variants (scripts/make-icons.mjs; visually verified), app.json ios.icon added (logged #8); splash image = new icon on ink => seamless launch. Live Activity / Dynamic Island proposal documented only (touches the bridge contract; needs explicit go-ahead). Phase 8 done; next: Phase 9 decision round.
### Iter 18 - Phase 9 decision round
- Full 7-agent panel on the entire app: art 7, UX 6, HIG 6.5, motion 7, native-parity 7, native-safety 9 PASS, anti-ai 8. art-director + ux-strategist merged findings into the ranked plan R1-R10 above.
