# NATIVE_CHANGES.md

Log of every native-affecting change on `ui-refine` (vs tag `ui-baseline`). Anything not listed here must not have changed.

| # | Iter | Change | Reason | Risk / verification |
|---|---|---|---|---|
| 1 | 3 | **Add** `widgets/DesignTokens.swift` (generated; enums `DTColor`, `DTSky`, `DTSpacing`, `DTRadius`, `DTFont`, funcs `dtColor`). Picked up automatically by react-native-widget-extension (compiles every `.swift` in `widgets/`). | Single source of truth for colours/sky/radii/spacing shared with JS (`scripts/sync-tokens.mjs`). Dynamic light/dark/Increase-Contrast via `UIColor` trait provider instead of an `.xcassets` colour catalogue (no asset-catalogue wiring needed, same behaviour). | No existing symbol modified. Names are `DT*`-prefixed to avoid colliding with `AthanWidget.swift` privates. **Not compiled locally (Windows); must be verified by the macOS CI build.** Not yet referenced by `AthanWidget.swift` (Phase 8). |
| 2 | 3 | **Add JS dependency** `@expo-google-fonts/fraunces` (pure JS + TTF assets, loaded via existing `expo-font`). | Display typeface per BRAND.md. | No native module added; no dev-client rebuild needed for the package itself. |
| 3 | 5 | **app.json styling values only**: `primaryColor` `#315C46` -> `#17121F`; `expo-splash-screen` `backgroundColor` `#194834` -> `#17121F`. | Launch screen base per brief (ink `#17121F`). | No plugin/entitlement/identifier change. Takes effect on next native build (prebuild). Splash image still the old green `icon.png` until the icon is redrawn (8g). |
| 4 | 5 | **Tab bar JS config**: removed Android-only `activeIndicatorColor` and the `barTintColor` (unconsumed) screen option; set `tabBarActiveTintColor`, `tabBarInactiveTintColor`, `hapticFeedbackEnabled` (no solid `tabBarStyle` background, to keep the system glass/blur) (library props) from tokens. | Token-driven tab styling; native selection haptic. | Same native module (`react-native-bottom-tabs`), props already supported by the installed version. |

## Proposals (not built)
- Live Activity / Dynamic Island for "time to next prayer": none exists today (`Attributes.swift` is a plugin stub). Would require `NSSupportsLiveActivities` plist key and ActivityKit state; deferred to the decision round.

## Verified unchanged (as of iter 3)
Bundle ID, App Group `group.com.bbabiker.AthanNow`, entitlements, plugins list, deployment target 16.4, `useFrameworks: static`, widget data key `athannow_widget` and JSON shape, `Module.swift`, `Attributes.swift`, `AthanWidget.swift`.
