export interface Reciter {
  id: string;
  /** Al Quran Cloud audio edition, which also names the per-ayah audio folder. */
  edition: string;
  /** Bitrate folder of the per-ayah MP3s on cdn.islamic.network. */
  bitrate: number;
  name: string;
  arabic: string;
  origin: string;
  style: 'Murattal' | 'Mujawwad';
  /** Word-by-word timing verified against this reciter's audio (see wordTiming in quranAudio.ts). */
  wordTiming: boolean;
}

export const RECITERS: Reciter[] = [
  { id: 'mishary', edition: 'ar.alafasy', bitrate: 128, name: 'Mishary Alafasy', arabic: 'مشاري العفاسي', origin: 'Kuwait', style: 'Murattal', wordTiming: true },
  { id: 'sudais', edition: 'ar.abdurrahmaansudais', bitrate: 192, name: 'Abdur-Rahman As-Sudais', arabic: 'عبد الرحمن السديس', origin: 'Saudi Arabia', style: 'Murattal', wordTiming: true },
  { id: 'mahermuaiqly', edition: 'ar.mahermuaiqly', bitrate: 128, name: 'Maher Al-Muaiqly', arabic: 'ماهر المعيقلي', origin: 'Saudi Arabia', style: 'Murattal', wordTiming: true },
  { id: 'saoodshuraym', edition: 'ar.saoodshuraym', bitrate: 64, name: 'Saud Ash-Shuraim', arabic: 'سعود الشريم', origin: 'Saudi Arabia', style: 'Murattal', wordTiming: true },
  { id: 'shaatree', edition: 'ar.shaatree', bitrate: 128, name: 'Abu Bakr Ash-Shatri', arabic: 'أبو بكر الشاطري', origin: 'Saudi Arabia', style: 'Murattal', wordTiming: true },
  { id: 'minshawi', edition: 'ar.minshawi', bitrate: 128, name: 'Al-Minshawi', arabic: 'محمد صديق المنشاوي', origin: 'Egypt', style: 'Murattal', wordTiming: true },
  { id: 'husary', edition: 'ar.husary', bitrate: 128, name: 'Mahmoud Al-Husary', arabic: 'محمود خليل الحصري', origin: 'Egypt', style: 'Murattal', wordTiming: true },
  { id: 'husarymujawwad', edition: 'ar.husarymujawwad', bitrate: 128, name: 'Al-Husary (Mujawwad)', arabic: 'محمود خليل الحصري', origin: 'Egypt', style: 'Mujawwad', wordTiming: true },
  { id: 'abdulbasit', edition: 'ar.abdulbasitmurattal', bitrate: 192, name: 'Abdul Basit', arabic: 'عبد الباسط عبد الصمد', origin: 'Egypt', style: 'Murattal', wordTiming: true },
  { id: 'hanirifai', edition: 'ar.hanirifai', bitrate: 192, name: 'Hani Ar-Rifai', arabic: 'هاني الرفاعي', origin: 'Syria', style: 'Murattal', wordTiming: true },
  { id: 'muhammadjibreel', edition: 'ar.muhammadjibreel', bitrate: 128, name: 'Muhammad Jibreel', arabic: 'محمد جبريل', origin: 'Egypt', style: 'Murattal', wordTiming: false },
  { id: 'abdullahbasfar', edition: 'ar.abdullahbasfar', bitrate: 192, name: 'Abdullah Basfar', arabic: 'عبد الله بصفر', origin: 'Saudi Arabia', style: 'Murattal', wordTiming: false },
];

export const DEFAULT_RECITER = RECITERS[0];

export function getReciter(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? DEFAULT_RECITER;
}
