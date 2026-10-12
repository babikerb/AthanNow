# NATIVE_CHANGES.md

Log of every native-affecting change on `ui-refine` (vs tag `ui-baseline`). Anything not listed here must not have changed.

| # | Iter | Change | Reason | Risk / verification |
|---|---|---|---|---|
| 1 | 3 | **Add** `widgets/DesignTokens.swift` (generated; enums `DTColor`, `DTSky`, `DTSpacing`, `DTRadius`, `DTFont`, funcs `dtColor`). Picked up automatically by react-native-widget-extension (compiles every `.swift` in `widgets/`). | Single source of truth for colours/sky/radii/spacing shared with JS (`scripts/sync-tokens.mjs`). Dynamic light/dark/Increase-Contrast via `UIColor` trait provider instead of an `.xcassets` colour catalogue (no asset-catalogue wiring needed, same behaviour). | No existing symbol modified. Names are `DT*`-prefixed to avoid colliding with `AthanWidget.swift` privates. **Not compiled locally (Windows); must be verified by the macOS CI build.** Not yet referenced by `AthanWidget.swift` (Phase 8). |
| 2 | 3 | **Add JS dependency** `@expo-google-fonts/fraunces` (pure JS + TTF assets, loaded via existing `expo-font`). | Display typeface per BRAND.md. | No native module added; no dev-client rebuild needed for the package itself. |

## Proposals (not built)
- Live Activity / Dynamic Island for "time to next prayer": none exists today (`Attributes.swift` is a plugin stub). Would require `NSSupportsLiveActivities` plist key and ActivityKit state; deferred to the decision round.

## Verified unchanged (as of iter 3)
Bundle ID, App Group `group.com.bbabiker.AthanNow`, entitlements, plugins list, deployment target 16.4, `useFrameworks: static`, widget data key `athannow_widget` and JSON shape, `Module.swift`, `Attributes.swift`, `AthanWidget.swift`.
