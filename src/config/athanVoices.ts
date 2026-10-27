/**
 * Athan recordings the user can choose for prayer notifications.
 *
 * Each `file` must also be listed in app.json under the expo-notifications plugin `sounds`, so iOS has it
 * in the app bundle, and must be 30 seconds or shorter (iOS plays nothing for longer notification sounds).
 * `source` is the same file bundled for in-app previews.
 */
export interface AthanVoice {
  id: string;
  name: string;
  detail?: string;
  file: string;
  source: number;
}

export const ATHAN_VOICES: AthanVoice[] = [
  { id: 'classic', name: 'Classic', detail: 'The original AthanNow athan', file: 'adhan.wav', source: require('../../assets/sounds/adhan.wav') },
];

export const DEFAULT_ATHAN_VOICE = ATHAN_VOICES[0].id;

export function athanVoice(id: string | undefined): AthanVoice {
  return ATHAN_VOICES.find((v) => v.id === id) ?? ATHAN_VOICES[0];
}
