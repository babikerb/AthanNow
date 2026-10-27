/**
 * Athan recordings the user can choose for prayer notifications.
 *
 * Each `file` must also be listed in app.json under the expo-notifications plugin `sounds`, so iOS has it
 * in the app bundle, and must be 30 seconds or shorter (iOS plays nothing for longer notification sounds).
 * `source` is the same file bundled for in-app previews. Recordings from Wikimedia Commons were cut to their
 * first 29.5 seconds (leading silence removed, faded out, mono) and are credited in Settings.
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
  name: string;
  file: string;
  source: number;
  credit?: AthanCredit;
}

export const ATHAN_VOICES: AthanVoice[] = [
  { id: 'classic', name: 'Default', file: 'adhan.wav', source: require('../../assets/sounds/adhan.wav') },
  {
    id: 'makkah',
    name: 'Makkah',
    file: 'athan-makkah.wav',
    source: require('../../assets/sounds/athan-makkah.wav'),
    credit: {
      title: 'Adhan, Great Mosque of Mecca, Jan 21, 2013',
      author: 'Seyfula Islam',
      license: 'CC BY 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm',
    },
  },
  {
    id: 'fakhri',
    name: 'Sabah Fakhri',
    file: 'athan-fakhri.wav',
    source: require('../../assets/sounds/athan-fakhri.wav'),
    credit: {
      title: 'Call to prayer by Sabah Fakhry',
      author: 'Sabah Fakhri',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Call_to_prayer_by_Sabah_Fakhry.mp3',
    },
  },
  {
    id: 'azeez',
    name: 'Aaqib Azeez',
    file: 'athan-azeez.wav',
    source: require('../../assets/sounds/athan-azeez.wav'),
    credit: {
      title: 'The Adhan, Muslim Call to Prayer, Aaqib Azeez',
      author: 'Atcovi',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Adhan_-_Muslim_Call_to_Prayer_-_Aaqib_Azeez.mp3',
    },
  },
  {
    id: 'casablanca',
    name: 'Casablanca',
    file: 'athan-casablanca.wav',
    source: require('../../assets/sounds/athan-casablanca.wav'),
    credit: {
      title: 'Llamada a oración, Mezquita Hassan II',
      author: 'Fraguando',
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Llamada_a_oraci%C3%B3n_Mezquita_Hassan_II.wav',
    },
  },
];

export const DEFAULT_ATHAN_VOICE = ATHAN_VOICES[0].id;

export function athanVoice(id: string | undefined): AthanVoice {
  return ATHAN_VOICES.find((v) => v.id === id) ?? ATHAN_VOICES[0];
}
