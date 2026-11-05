import { Directory, File, Paths } from 'expo-file-system';

import { clipFile } from './clipCache';
import { audioRange } from './mp3';
import { ayahNumber } from './quranAudio';
import type { Reciter } from './reciters';

/** Where one clip starts in a track. `index` is the ayah's index in its surah, -1 for the Bismillah. */
export interface Mark {
  index: number;
  start: number;
  seconds: number;
}

export interface Track {
  uri: string;
  surahId: number;
  marks: Mark[];
  /** The first ayah index after this track. */
  end: number;
}

const root = new Directory(Paths.cache, 'recitation-tracks');
let serial = 0;

/**
 * Joins clips into one MP3, so the player runs straight through them with no gap between ayahs. The
 * files are one encoding per reciter (a few vary in bitrate, which is why the app never seeks across
 * a track: it builds one from the ayah instead). Null if none of the clips could be read.
 */
export async function buildTrack(reciter: Reciter, surahId: number, from: number, end: number, bismillah: boolean): Promise<Track | null> {
  const parts: Uint8Array[] = [];
  const marks: Mark[] = [];
  let start = 0;
  let size = 0;
  let last = from;
  const clips = bismillah ? [{ index: -1, number: 1 }] : [];
  for (let i = from; i < end; i++) clips.push({ index: i, number: ayahNumber(surahId, i) });

  for (const clip of clips) {
    const bytes = await clipFile(reciter, clip.number).bytes();
    const range = audioRange(bytes);
    if (!range) break;
    parts.push(bytes.subarray(range.start, range.end));
    size += range.end - range.start;
    marks.push({ index: clip.index, start, seconds: range.seconds });
    start += range.seconds;
    if (clip.index >= 0) last = clip.index + 1;
  }
  if (!marks.length) return null;

  const joined = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  serial += 1;
  const file = new File(root, `${Date.now()}-${serial}.mp3`);
  file.create({ overwrite: true });
  file.write(joined);
  return { uri: file.uri, surahId, marks, end: last };
}

/** The clip playing at `time`. */
export function markAt(track: Track, time: number): Mark {
  let mark = track.marks[0];
  for (const m of track.marks) {
    if (m.start > time) break;
    mark = m;
  }
  return mark;
}

export function deleteTrack(track: Track | null) {
  try {
    if (track) new File(track.uri).delete();
  } catch {
    // already gone
  }
}

/** Removes tracks left by the last run. */
export function clearTracks() {
  try {
    if (root.exists) root.delete();
  } catch {
    // left for iOS to clear
  }
}
