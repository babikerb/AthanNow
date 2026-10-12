# DESIGN_AUDIT.md (Phase 1, baseline `ui-baseline` = f2ff37e)

## 1. What the app is
AthanNow: iOS-only prayer-times app (Expo SDK 56, RN 0.85, new-arch dev client). Core loop: **glance → "which prayer is next and in how long?"**, get an athan notification, check Qibla, read Quran (mushaf), look up Hijri date. Secondary: home-screen widget, onboarding that overlays the real UI.
Audience: practising Muslims; wants calm, reverent, trustworthy, not gamified.

## 2. Screen / flow inventory (main app)
| Screen | File | Notes |
|---|---|---|
| Athan (Home, hero) | `screens/AthanScreen.tsx` (431) | No-scroll column. AmbientGradient sky + SkyScene + countdown (hero type) + progress rule + 6-row list + Hijri date. Location pill → LocationSheet. Dynamic Type capped at 1.3. |
| Calendar | `CalendarScreen.tsx` (436) | Hijri/Gregorian, fixed-height day cards, jump-to-today, SafeAreaScrim |
| Quran | `QuranScreen.tsx` (403) | Surah list + readers (QuranReader text, MushafReader/MushafImageReader/MushafPage), forced-light ivory reading palette, liquid-glass controls, BookmarkSheet, SurahPickerSheet |
| Qibla | `QiblaScreen.tsx` (315) | Always-night (`NIGHT_BG #070d18`) instrument; 24 hardcoded colours (worst offender) |
| Settings | `SettingsScreen.tsx` (429) | `settings/SettingsRows`, Sheet-based pickers, replay onboarding. Appearance toggle missing (app forced dark). |
| Onboarding overlay | `components/onboarding/*` | Intro, Permission, CalcMethod, Widget, Info, Outro + Beacon + ProgressBar + StaggerReveal + WidgetPreview |
| Sheets | `Sheet`, `LocationSheet`, `BookmarkSheet`, `SurahPickerSheet` | JS sheets (custom `Sheet.tsx`), not native detents |
| Missing | Not-Found; appearance setting; skeleton/error states mostly absent | Navigation is react-navigation + `@bottom-tabs` (no stack screens, so no large-title/native-stack needed today) |

## 3. Native surface inventory
- **Tab bar**: fully native `UITabBar` via `@bottom-tabs/react-navigation` (`react-native-bottom-tabs`); iOS 26 renders Liquid Glass automatically. `barTintColor '#0B0B0D'`, active tint `#4FAE86`. 5 tabs (Athan, Calendar, Quran, Qibla, Settings) with SF Symbols.
- **WidgetKit** (`widgets/AthanWidget.swift`, 589 lines): systemSmall/Medium/Large + accessoryInline/Circular/Rectangular + a "prayer group" rectangular. Backdrop = sky gradient mirror of JS `prayerGradients` with blend toward next prayer. Hex-duplicated (`GRADIENTS`, `Color(hex:)`), `.system(size:)` fonts, white-opacity text everywhere. Reads App Group `group.com.bbabiker.AthanNow`, key `athannow_widget`, JSON `{city, times:[{name,time}], use24Hour}`.
- **Live Activities / Dynamic Island**: NONE. `Attributes.swift` / `Module.swift` are stubs required by `react-native-widget-extension`. → Nothing to restyle; proposing one goes in NATIVE_CHANGES.md only.
- **Launch screen**: `expo-splash-screen` plugin, bg `#194834` (old green) + `assets/icon.png`. → update to `#17121F` (config value only).
- **App icon**: `assets/icon.png` (green). Light/dark/tinted variants need new art (binary assets; cannot be verified on Windows).
- **Notifications**: `expo-notifications`, custom `adhan.wav` sound; no content extension. Nothing to style.
- **liquid-glass** (`@callstack/liquid-glass`): native view used in Quran controls / FloatingControl.
- **App Intents / other extensions**: none.
- Android assets (`android-icon-*`, `activeIndicatorColor`) exist — **ignored, never touched**.

## 4. Native-module dependency map
- Athan: expo-location (useLocation), expo-notifications, expo-haptics, shared-group-preferences (widget write), react-native-linear-gradient, react-native-svg, expo-symbols.
- Calendar: haptics, symbols, location. Qibla: expo-location heading (useQibla), svg, haptics. Quran: async-storage, liquid-glass, haptics, svg/images. Settings: constants, notifications perms, async-storage. Onboarding: all permission modules.
- Gradients use **`react-native-linear-gradient`** (not expo-linear-gradient). Animation uses RN core `Animated` (native driver) — **react-native-reanimated, gesture-handler, expo-blur, expo-linear-gradient, skia are NOT installed**.

## 5. Hardcoded old colours (to remove; counts of hex/rgba literals)
`theme/colors.ts` 31 (source), `QiblaScreen` 24, `SkyScene` 17, `AthanScreen` 6, `CalcMethodStep` 6, `widgets/AthanWidget.swift` 4 (+ the GRADIENTS table), `CalendarScreen` 4, `OnboardingBeacon` 4, `WidgetStep` 3, `FloatingControl` 3, `AmbientGradient` 3, `App.tsx` 3 (`#194834` splash bg, `#0B0B0D` bar tint, `rgba(79,174,134,.35)`), `app.json` 2 (`#315C46` primaryColor, splash `#194834`), plus 1 each in Settings/Quran/MushafPage/shadow/SettingsRows/PermissionStep/Outro/Intro/Info/WidgetPreview/ProgressBar/SurahPickerSheet/QuranReader/IconButton.
Old scheme = near-black neutral `#0B0B0D/#161618/#202023`, pure white text, green `#315C46 / #4FAE86`, `NIGHT_BG #070d18`, stock iOS green `#34C759` / red `#E5484D`.

## 6. Where native diverges from the app (parity gaps)
1. Widget gradients are a hand-copied duplicate of JS gradients (drift risk) → single source via sync-tokens.
2. Widget typography `.system(size:)` fixed sizes (no Dynamic Type), no brand display face.
3. Widget text = white with ad-hoc opacities; accent not used; no tonal surfaces.
4. Widget lacks tinted/clear-mode handling (`widgetAccentable`, `widgetRenderingMode`) review needed.
5. Tab bar colours/tint are old green on `#0B0B0D`.
6. Splash `#194834` vs app bg; icon green.
7. Widget has no equivalent of in-app Home hero other than SkyBackground gradient — in-app `src/widgets/` reference set doesn't exist yet.

## 7. The Home sky scene — how it is built (KEEP; refine only)
- `AthanScreen` picks `prayerGradients[currentPrayer]` (6 stages: fajr, sunrise, dhuhr, asr, maghrib, isha; 4–6 sRGB hex stops) → `AmbientGradient`: two crossed `LinearGradient`s (diagonals, second at 0.45 opacity) + optional bottom scrim (0.35 dhuhr / 0.15 else).
- `SkyScene` (absolute overlay): celestial body (sun w/ pulse glow & rays / crescent via SVG mask / sunrise sun) placed on shallow ellipse arc by per-stage degree; star fields (twinkling, per-stage); static clouds + birds for day stages. `Animated` with native driver; Reduce-Motion respected.
- **Known roughness to refine**: stage changes are hard cuts (comment says cross-fade deliberately removed "per explicit feedback" — the brief now requires smooth long crossfades; do ONE slow crossfade at stage boundary only, not the old continuous blend-toward-next, to respect that history); sRGB linear stop interpolation (muddy mids) → precompute OKLCH stops; no dither (banding likely on near-black isha/fajr); no parallax; harmonise stops with `#17121F` (isha currently `#070d18` cold navy; fajr `#0c0b1c` already purple-leaning); dhuhr is light sky-blue `#8eb2c4` → toned/darkened so the scene still flows into the ink UI.
- Widget mirrors the same gradients (+ blend toward next prayer using `gradientShiftMinutes`).

## 8. Do-not-touch list
- `widgets/Module.swift`, `Attributes.swift` (plugin stubs); widget `loadWidgetData`/`WidgetData`/App Group id/`athannow_widget` key/JSON shape; timeline/provider logic and family list.
- app.json: bundle id, entitlements (App Group, time-sensitive), plugins list & `deploymentTarget`, `useFrameworks`, `ITSAppUsesNonExemptEncryption`, runtime/updates/EAS ids. (Only styling values allowed: splash `backgroundColor`, `primaryColor`, `userInterfaceStyle` decision.)
- `utils/prayerEngine.ts`, `notifications.ts`, `backgroundRefresh.ts`, `widgetData.ts`, `widget.ts`, `useLocation`, `useQibla`, contexts' state logic, `data/*`, `quran*`/`mushaf*` utils.
- Notification sound asset; Quran font `AmiriQuran` and mushaf rendering logic.
- New native deps (reanimated, expo-blur, gesture-handler, expo-linear-gradient, skia) require a dev-client rebuild → each needs a NATIVE_CHANGES.md entry. **Default decision: avoid; use RN `Animated`, existing `react-native-linear-gradient`, `react-native-svg`, a pre-rendered noise PNG for dither.**

## 9. Decisions / conflicts needing a ruling (made now, per "don't ask")
1. **Colour**: brief overrides earlier green brand. Ink `#17121F` + apricot `#E8B07A`.
2. **Tab bar**: code history shows a custom bar was tried and *reverted to native on explicit preference*; brief now asks for a custom floating bar. Decision: keep `react-native-bottom-tabs` (native UITabBar, native haptics/liquid-glass, zero native risk) and style it with tokens (tint, barTintColor, appearance). Evaluate in Phase 5 whether the library's custom `tabBar` render prop allows a floating JS bar over the sky *without* swapping the native module; if not, document and keep native. Needs art-director + HIG sign-off.
3. **Light mode**: app is dark-forced (`userInterfaceStyle: automatic` in app.json but ThemeContext constant). Brief wants light palette + appearance toggle. Add to Settings in Phase 6; Athan/Qibla stay night-sky regardless. Quran keeps reading palette (warm paper) tuned to lavender-paper.
4. **Iterations that touch widgets** can only be compile-verified in CI (macOS runner), not locally.

## 10. Sub-task seeds
**Phase 6 (screens)**: 6a Home sky refinement (OKLCH stops, dither, crossfade, parallax, harmonise) · 6b Home chrome (countdown, list, pill, date) · 6c Calendar · 6d Quran (list + reader chrome + sheets) · 6e Qibla · 6f Settings (+ appearance toggle) · 6g Onboarding (6 steps + beacon) · 6h Sheets (LocationSheet/Sheet/Bookmark/SurahPicker) · 6i Not-Found/empty/error/skeleton states.
**Phase 8 (native)**: 8a Widget small · 8b medium · 8c large · 8d lock-screen accessories (inline/circular/rectangular/group) · 8e tinted/clear/StandBy modes · 8f launch screen (splash config) · 8g app icon (needs art; propose in NATIVE_CHANGES) · 8h tab bar tint · 8i fonts in widget extension (Info.plist UIAppFonts — logged change) · 8j Live Activity proposal (document only).
