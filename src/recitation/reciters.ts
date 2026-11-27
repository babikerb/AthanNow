export interface Reciter {
  id: string;
  /** quran.com's audio reciter id: one continuous recording per surah, with every ayah's and word's timing. */
  qdc?: number;
  /** Or mp3quran.net's: a recording per surah with each ayah's timing (no word timing). */
  mp3quran?: { read: number; folder: string };
  name: string;
  arabic: string;
  origin: string;
  style: 'Murattal' | 'Mujawwad' | 'Muallim';
}

export const RECITERS: Reciter[] = [
  { id: 'mishary', qdc: 7, name: 'Mishary Alafasy', arabic: 'مشاري العفاسي', origin: 'Kuwait', style: 'Murattal' },
  { id: 'mahermuaiqly', mp3quran: { read: 133, folder: 'https://cdn.mp3quran.net/audio/maher-muaiqly/r3/' }, name: 'Maher Al-Muaiqly', arabic: 'ماهر المعيقلي', origin: 'Saudi Arabia', style: 'Murattal' },
  { id: 'sudais', qdc: 3, name: 'Abdur-Rahman As-Sudais', arabic: 'عبد الرحمن السديس', origin: 'Saudi Arabia', style: 'Murattal' },
  { id: 'saoodshuraym', qdc: 10, name: 'Saud Ash-Shuraim', arabic: 'سعود الشريم', origin: 'Saudi Arabia', style: 'Murattal' },
  { id: 'dossary', qdc: 97, name: 'Yasser Ad-Dossary', arabic: 'ياسر الدوسري', origin: 'Saudi Arabia', style: 'Murattal' },
  { id: 'shaatree', qdc: 4, name: 'Abu Bakr Ash-Shatri', arabic: 'أبو بكر الشاطري', origin: 'Saudi Arabia', style: 'Murattal' },
  { id: 'minshawi', qdc: 9, name: 'Al-Minshawi', arabic: 'محمد صديق المنشاوي', origin: 'Egypt', style: 'Murattal' },
  { id: 'husary', qdc: 6, name: 'Mahmoud Al-Husary', arabic: 'محمود خليل الحصري', origin: 'Egypt', style: 'Murattal' },
  { id: 'husarymuallim', qdc: 12, name: 'Al-Husary (Teaching)', arabic: 'محمود خليل الحصري', origin: 'Egypt', style: 'Muallim' },
  { id: 'abdulbasit', qdc: 2, name: 'Abdul Basit', arabic: 'عبد الباسط عبد الصمد', origin: 'Egypt', style: 'Murattal' },
  { id: 'abdulbasitmujawwad', qdc: 1, name: 'Abdul Basit (Mujawwad)', arabic: 'عبد الباسط عبد الصمد', origin: 'Egypt', style: 'Mujawwad' },
  { id: 'hanirifai', qdc: 5, name: 'Hani Ar-Rifai', arabic: 'هاني الرفاعي', origin: 'Syria', style: 'Murattal' },
];

export const DEFAULT_RECITER = RECITERS[0];

export function getReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? DEFAULT_RECITER;
}
