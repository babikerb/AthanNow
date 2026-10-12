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
- [ ] 1. AUDIT → `DESIGN_AUDIT.md`
- [ ] 2. BRAND → `BRAND.md` (gate: art-director, anti-ai-critic, ux-strategist approve)
- [ ] 3. SHARED DESIGN TOKENS (`design/tokens.json`, `src/design/tokens.ts`, ThemeProvider, `DesignTokens.swift`, `scripts/sync-tokens`)
- [ ] 4. DESIGN SYSTEM (`src/design`)
- [ ] 5. CUSTOM TAB BAR
- [ ] 6. ALL SCREENS (sub-tasks seeded by audit)
- [ ] 7. IN-APP WIDGETS (`src/widgets`)
- [ ] 8. NATIVE iOS PARITY (sub-tasks seeded by audit)
- [ ] 9. DESIGN DECISION ROUND
- [ ] 10. FINAL full-panel scoring → FINAL SUMMARY

## Review backlog
(empty)

## Iteration log
### Iter 0 — setup
- Created branch/tag, agents. tsc baseline clean. No panel run (no visual change).
