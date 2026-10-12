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
- [ ] 3. SHARED DESIGN TOKENS (`design/tokens.json`, `src/design/tokens.ts`, ThemeProvider, `DesignTokens.swift`, `scripts/sync-tokens`)
- [ ] 4. DESIGN SYSTEM (`src/design`)
- [ ] 5. CUSTOM TAB BAR
- [ ] 6. ALL SCREENS
  - [ ] 6a Home sky refinement (OKLCH, dither PNG, slow crossfade, parallax, harmonise with ink)
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
