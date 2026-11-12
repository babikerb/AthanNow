/**
 * Features switched off for now. Turning one back on restores its tab, settings and notifications.
 * The Quran reader's code is kept (src/screens/QuranScreen.tsx and friends) for a later redesign.
 */
export const QURAN_ENABLED = false;

/**
 * The Quran tab (listening to recitations, src/screens/RecitationScreen.tsx and src/recitation).
 * Held back from this release; while off, the tab is hidden and the player isn't mounted, so it
 * never takes the lock screen controls.
 */
export const RECITATION_ENABLED = false;
