/**
 * Features switched off for now. Turning one back on restores its tab, settings and notifications.
 * The Quran reader's code is kept (src/screens/QuranScreen.tsx and friends) for a later redesign.
 */
export const QURAN_ENABLED = false;

/**
 * The Quran tab: the printed mushaf with the recitation over it (src/screens/MushafScreen.tsx and
 * src/recitation). While off, the tab is hidden and the player isn't mounted, so it never takes the
 * lock screen controls. Needs background audio on in app.json (expo-audio enableBackgroundPlayback).
 */
export const RECITATION_ENABLED = true;
