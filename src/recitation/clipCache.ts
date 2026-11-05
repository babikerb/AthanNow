import { Directory, File, Paths } from 'expo-file-system';

import { ayahAudioUrl } from './quranAudio';
import type { Reciter } from './reciters';

/**
 * Ayah recordings kept on the device. The first few download before playback starts and the rest
 * of the surah while it plays, so moving on loads a local file with no network wait; expo-audio's
 * own preload throws on hand-over. Lives in
 * the system cache folder, which iOS may clear, so a miss just streams from the CDN.
 */
const MAX_BYTES = 300 * 1024 * 1024;

const root = new Directory(Paths.cache, 'recitation');
const inFlight = new Map<string, Promise<void>>();

export const clipFile = (reciter: Reciter, ayahNumber: number) => new File(root, `${reciter.edition}-${ayahNumber}.mp3`);

export function hasClip(reciter: Reciter, ayahNumber: number): boolean {
  try {
    return clipFile(reciter, ayahNumber).exists;
  } catch {
    return false;
  }
}

/** A file URI if this clip is on the device, otherwise its CDN address. */
export function clipSource(reciter: Reciter, ayahNumber: number): string {
  try {
    const file = clipFile(reciter, ayahNumber);
    if (file.exists) return file.uri;
  } catch {
    // stream it instead
  }
  return ayahAudioUrl(reciter, ayahNumber);
}

/** Downloads a clip if it isn't here yet. Never rejects: a failed download only means streaming. */
export function fetchClip(reciter: Reciter, ayahNumber: number): Promise<void> {
  const key = `${reciter.edition}-${ayahNumber}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    try {
      const file = clipFile(reciter, ayahNumber);
      if (file.exists) return;
      if (!root.exists) root.create({ intermediates: true, idempotent: true });
      // Under a temporary name until complete, so a half-downloaded clip is never played.
      const part = new File(root, `${key}.part`);
      const done = await File.downloadFileAsync(ayahAudioUrl(reciter, ayahNumber), part, { idempotent: true });
      await done.move(file);
    } catch {
      // streams from the CDN when its turn comes
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, job);
  return job;
}

/** Clears the folder once it has grown past MAX_BYTES. Called once at startup. */
export function trimClips() {
  try {
    if (root.exists && (root.size ?? 0) > MAX_BYTES) root.delete();
  } catch {
    // left for iOS to clear
  }
}
