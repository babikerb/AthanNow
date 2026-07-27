/**
 * Global elevation/shadow tokens for AthanNow.
 *
 * The app's default depth language is hairline borders + a fill color one
 * step lighter/darker than its background (already how Calendar and
 * Settings behave) — not shadows. This single shadow token is reserved for
 * transient overlays that float above live, moving content (the Spotlight
 * tooltip card, the Quran immersive-mode floating bookmark/search circles),
 * not persistent, in-flow page furniture. Native `Modal`-based sheets get no
 * additional shadow — the OS-native page-sheet presentation already
 * provides its own system shadow/dimming.
 */

export const shadow = {
  floating: {
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export type ShadowToken = keyof typeof shadow;
