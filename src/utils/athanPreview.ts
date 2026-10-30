import type { AudioPlayer } from 'expo-audio';

import { pauseRecitation } from '../recitation/RecitationProvider';

let player: AudioPlayer | null = null;
let sub: { remove: () => void } | null = null;

/**
 * Plays an athan recording in the app (Settings preview), stopping any preview already playing.
 * expo-audio is loaded on first use, so a build without it simply reports that previews are unavailable.
 * Plays even with the ring/silent switch on silent, since the user asked to hear it.
 */
export function playAthanPreview(source: number, onFinish: () => void): boolean {
  stopAthanPreview();
  pauseRecitation();
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    audio.setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const p = audio.createAudioPlayer(source);
    player = p;
    sub = p.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish && player === p) {
        stopAthanPreview();
        onFinish();
      }
    });
    p.play();
    return true;
  } catch {
    stopAthanPreview();
    return false;
  }
}

export function stopAthanPreview() {
  sub?.remove();
  sub = null;
  const p = player;
  player = null;
  if (!p) return;
  try {
    p.pause();
    p.remove();
  } catch {
    // already released
  }
}
