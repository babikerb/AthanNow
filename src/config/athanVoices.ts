/**
 * Athan recordings the user can choose for prayer notifications.
 *
 * Each `file` must also be listed in app.json under the expo-notifications plugin `sounds`, so iOS has it
 * in the app bundle, and must be 30 seconds or shorter (iOS plays nothing for longer notification sounds).
 * `source` is the same file bundled for in-app previews.
 *
 * Entries without a `file` are placeholders: they show in the picker as coming soon and can't be chosen.
 * To add one, drop the 30-second clip in assets/sounds, set `file` and `source`, and list it in app.json.
 */
export interface AthanCredit {
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
}

export interface AthanVoice {
  id: string;
  /** The reciter. */
  name: string;
  /** Where the reciter is known from, shown under the name. */
  region?: string;
  file?: string;
  source?: number;
  credit?: AthanCredit;
}

export const ATHAN_VOICES: AthanVoice[] = [
  // The original AthanNow recording; the id stays 'classic' so existing choices are kept.
  { id: 'classic', name: 'Ali Ahmed Mulla', region: 'Makkah', file: 'adhan.wav', source: require('../../assets/sounds/adhan.wav') },
  { id: 'qassas', name: 'Muhammad Marwan Qassas', region: 'Medina' },
  { id: 'abdussamad', name: 'Abdulbasit Abdussamad', region: 'Egypt' },
  { id: 'siddiq', name: 'Noreen Mohamad Siddiq', region: 'Sudan' },
  { id: 'youssef', name: 'Almajd Youssef' },
];

export const DEFAULT_ATHAN_VOICE = ATHAN_VOICES[0].id;

/** The voice to use: the chosen one if it has a recording, otherwise the default. */
export function athanVoice(id: string | undefined): AthanVoice {
  const v = ATHAN_VOICES.find((x) => x.id === id);
  return v?.file ? v : ATHAN_VOICES[0];
}
