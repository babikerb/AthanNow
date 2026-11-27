import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { addRemoteCommandListener, clearNowPlaying, disableRemoteCommands, enableRemoteCommands, setNowPlaying } from 'lock-screen-track-controls';
import { Image } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getSurah } from '../data/surahs';
import { getReciter, type Reciter } from './reciters';
import { ayahIndexAt, loadSurahAudio, wordAt, type SurahAudio } from './surahAudio';

export type RepeatMode = 'off' | 'ayah' | 'surah';
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

const STATE_KEY = 'athannow.recitation.state.v1';

interface Saved {
  surahId: number | null;
  ayahIndex: number;
  reciterId: string;
  repeat: RepeatMode;
  autoplay: boolean;
  rate: number;
}

const DEFAULTS: Saved = { surahId: null, ayahIndex: 0, reciterId: 'mishary', repeat: 'off', autoplay: true, rate: 1 };

export interface Recitation {
  ready: boolean;
  surahId: number | null;
  /** The ayah being recited, by index in its surah. */
  ayahIndex: number;
  /** Always false: each recording carries its own Bismillah inside ayah 1. Kept for the screens. */
  inBismillah: boolean;
  /** Always null: recordings stream, nothing is downloaded first. Kept for the screens. */
  preparing: { done: number; total: number } | null;
  /** True while a surah's recording is being found and opened. */
  loading: boolean;
  error: string | null;
  isPlaying: boolean;
  reciter: Reciter;
  repeat: RepeatMode;
  autoplay: boolean;
  rate: number;
  /** Plays a surah from an ayah (index in the surah). */
  playSurah: (surahId: number, ayahIndex?: number) => void;
  goToAyah: (index: number) => void;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  pause: () => void;
  /** Stops and clears the player, including the lock screen. */
  stop: () => void;
  setReciter: (id: string) => void;
  cycleRepeat: () => void;
  setRepeat: (mode: RepeatMode) => void;
  setAutoplay: (on: boolean) => void;
  setRate: (rate: number) => void;
}

export interface RecitationProgress {
  /** Seconds into the current ayah. */
  currentTime: number;
  /** Length of the current ayah in seconds. */
  duration: number;
  buffering: boolean;
  /** The word (from 1) of the current ayah being recited, or 0 without word timing. */
  word: number;
  /** Seeks within the current ayah. */
  seekTo: (fraction: number) => void;
}

const Ctx = createContext<Recitation | null>(null);
const ProgressCtx = createContext<RecitationProgress | null>(null);

// Lets other audio in the app (the athan preview in Settings) pause the recitation first.
let pauseHandler: (() => void) | null = null;
export function pauseRecitation() {
  pauseHandler?.();
}

const ARTWORK = Image.resolveAssetSource(require('../../assets/icon.png')).uri;
const AUDIO_MODE = { playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' } as const;
// A repeated ayah loops back this close to its end, so the next ayah's first sound never slips in.
const LOOP_EARLY_MS = 60;

/**
 * iOS's media server can restart under pressure, and native calls made in that window throw instead
 * of waiting. Those are transient, so retry with backoff, and give up once the request is stale.
 */
async function retry(fn: () => unknown, aborted: () => boolean, attempts = 4): Promise<boolean> {
  for (let n = 1; n <= attempts; n++) {
    if (aborted()) return false;
    try {
      await fn();
      return true;
    } catch (err) {
      if (n === attempts) {
        console.warn('[recitation] native call failed', err);
        return false;
      }
      await new Promise((r) => setTimeout(r, 250 * 2 ** (n - 1)));
    }
  }
  return false;
}

async function startPlayback(player: AudioPlayer, aborted: () => boolean) {
  // Re-applied each time: the athan preview sets its own (foreground) mode.
  await setAudioModeAsync(AUDIO_MODE).catch(() => {});
  if (await retry(() => player.play(), aborted)) return;
  await setAudioModeAsync(AUDIO_MODE).catch(() => {});
  await retry(() => player.play(), aborted, 2);
}

/**
 * The recitation. Each surah is one continuous recording, so it runs from ayah to ayah exactly as the
 * reciter recorded it, with nothing joined, faded or cut. Its ayah timings say which ayah is playing,
 * where to jump for an ayah, and where a repeated ayah loops.
 */
export function RecitationProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { surahId, ayahIndex, reciterId, repeat, autoplay, rate } = saved;
  const reciter = getReciter(reciterId);
  const patch = useCallback((p: Partial<Saved>) => setSaved((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    AsyncStorage.getItem(STATE_KEY)
      .then((raw) => raw && setSaved({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) }))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(STATE_KEY, JSON.stringify(saved)).catch(() => {});
  }, [saved, ready]);

  // Created once with no source; sources change only through replace(), as Expo documents.
  // keepAudioSessionActive keeps the lock screen controls answering after an in-app pause.
  const player = useAudioPlayer(null, { updateInterval: 100, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);

  // The recording on the player, and a position waiting for it to be ready.
  const loaded = useRef<{ key: string; audio: SurahAudio } | null>(null);
  const pendingSeek = useRef<{ seconds: number; since: number } | null>(null);
  const request = useRef(0);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;
  const [loadedTick, setLoadedTick] = useState(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  // When a repeated ayah last looped, so the statuses that arrive mid-seek don't loop it again.
  const loopedAt = useRef(0);

  // What the status listener needs, without waiting for a render.
  const live = useRef({ surahId, ayahIndex, repeat, autoplay });
  live.current = { surahId, ayahIndex, repeat, autoplay };

  const seek = useCallback(
    (seconds: number) => {
      const n = request.current;
      return retry(() => player.seekTo(seconds), () => request.current !== n);
    },
    [player],
  );

  /** Plays `surah` from ayah `index`: a seek if its recording is already on the player, else it loads. */
  const start = useCallback(
    (surah: number, index: number, who: Reciter = reciter) => {
      const n = ++request.current;
      const aborted = () => request.current !== n;
      setError(null);
      setIsPlaying(true);
      patch({ surahId: surah, ayahIndex: index });
      const key = `${who.id}:${surah}`;
      const have = loaded.current;
      if (have && have.key === key && !pendingSeek.current) {
        const from = (have.audio.ayahs[index]?.[0] ?? 0) / 1000;
        seek(from).then((ok) => {
          if (ok) startPlayback(player, aborted);
        });
        return;
      }
      setLoading(true);
      loadSurahAudio(who, surah)
        .then((audio) => {
          if (aborted()) return;
          loaded.current = { key, audio };
          pendingSeek.current = { seconds: (audio.ayahs[index]?.[0] ?? 0) / 1000, since: Date.now() };
          return retry(() => player.replace({ uri: audio.url }), aborted).then((ok) => {
            if (!ok) throw new Error('replace');
            player.setPlaybackRate(rateRef.current);
            setLoadedTick((x) => x + 1);
          });
        })
        .catch(() => {
          if (aborted()) return;
          loaded.current = null;
          pendingSeek.current = null;
          setError('Could not load this recitation. Check your connection and try again.');
          setIsPlaying(false);
          setLoading(false);
        });
    },
    [reciter, patch, seek, player],
  );
  const startRef = useRef(start);
  startRef.current = start;

  // Follows the recording: once it's ready, the waiting position; then which ayah is playing, a
  // repeated ayah's loop, and what happens at the end.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      const have = loaded.current;
      if (!have) return;
      const L = live.current;
      const pending = pendingSeek.current;
      if (pending) {
        // Statuses right after replace() can still describe the last recording: wait for one this long.
        const expected = have.audio.ayahs[have.audio.ayahs.length - 1][1] / 1000;
        const ours = st.isLoaded && st.duration > 0 && Math.abs(st.duration - expected) < 15;
        if (!ours && Date.now() - pending.since < 4000) return;
        pendingSeek.current = null;
        const n = request.current;
        seek(pending.seconds).then((ok) => {
          setLoading(false);
          if (ok && playingRef.current) startPlayback(player, () => request.current !== n);
        });
        return;
      }

      const ms = st.currentTime * 1000;
      if (st.didJustFinish) {
        if (L.repeat === 'ayah') {
          seek(have.audio.ayahs[L.ayahIndex][0] / 1000).then((ok) => {
          if (ok) startPlayback(player, () => false);
        });
        } else if (L.repeat === 'surah') {
          seek(0).then((ok) => {
          if (ok) startPlayback(player, () => false);
        });
          patch({ ayahIndex: 0 });
        } else if (L.autoplay && L.surahId && L.surahId < 114) {
          startRef.current(L.surahId + 1, 0);
        } else {
          setIsPlaying(false);
        }
        return;
      }
      if (!st.playing) return;
      if (L.repeat === 'ayah') {
        const [from, to] = have.audio.ayahs[L.ayahIndex] ?? [0, 0];
        if (ms >= to - LOOP_EARLY_MS && Date.now() - loopedAt.current > 800) {
          loopedAt.current = Date.now();
          seek(from / 1000);
        }
        return;
      }
      const index = ayahIndexAt(have.audio, ms);
      if (index !== L.ayahIndex) patch({ ayahIndex: index });
    });
    return () => sub.remove();
  }, [player, patch, seek]);

  // A new reciter picks up the same ayah in their recording.
  const lastReciter = useRef(reciter.id);
  useEffect(() => {
    if (lastReciter.current === reciter.id) return;
    lastReciter.current = reciter.id;
    if (loaded.current && surahId) {
      const wasPlaying = playingRef.current;
      start(surahId, ayahIndex, reciter);
      if (!wasPlaying) setIsPlaying(false);
    }
  }, [reciter.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      player.setPlaybackRate(rate);
    } catch {
      // applied when the next recording loads
    }
  }, [rate, player]);

  // Play/pause intent -> player.
  useEffect(() => {
    if (!loaded.current || pendingSeek.current) return;
    const n = request.current;
    if (isPlaying && !status.playing) startPlayback(player, () => request.current !== n);
    if (!isPlaying && status.playing) retry(() => player.pause(), () => request.current !== n);
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player -> intent, for pauses that didn't come from the app (the lock screen, a call, headphones).
  useEffect(() => {
    if (!loaded.current || pendingSeek.current || loading || !status.isLoaded || status.isBuffering || status.didJustFinish) return;
    if (status.playing !== isPlaying) setIsPlaying(status.playing);
  }, [status.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock screen and Control Center: the current ayah with its own length. Sent on each change only;
  // iOS runs the bar itself in between.
  const surah = surahId ? getSurah(surahId) : undefined;
  const [seekTick, setSeekTick] = useState(0);
  const lockScreenOn = useRef(false);
  useEffect(() => {
    const audio = loaded.current?.audio;
    const span = audio?.ayahs[ayahIndex];
    if (!surah || !span || (!lockScreenOn.current && !isPlaying)) return;
    lockScreenOn.current = true;
    const seconds = (span[1] - span[0]) / 1000;
    const elapsed = Math.min(seconds, Math.max(0, player.currentTime - span[0] / 1000));
    setNowPlaying({ title: `${surah.transliteration}: Ayah ${ayahIndex + 1}`, artist: reciter.name, album: 'AthanNow', duration: seconds, elapsed, rate: isPlaying ? rate : 0, artwork: ARTWORK });
  }, [surah, ayahIndex, reciter.name, isPlaying, rate, seekTick, loadedTick, player]);

  const goToAyah = useCallback(
    (index: number) => {
      const s = live.current.surahId;
      if (!s) return;
      const total = getSurah(s)?.totalVerses ?? 0;
      const i = Math.min(Math.max(0, index), total - 1);
      const have = loaded.current;
      if (have && !pendingSeek.current && have.key.endsWith(`:${s}`)) {
        patch({ ayahIndex: i });
        seek(have.audio.ayahs[i][0] / 1000).then(() => setSeekTick((x) => x + 1));
      } else start(s, i);
    },
    [patch, seek, start],
  );
  const next = useCallback(() => goToAyah(live.current.ayahIndex + 1), [goToAyah]);
  const previous = useCallback(() => goToAyah(live.current.ayahIndex - 1), [goToAyah]);

  useEffect(() => {
    enableRemoteCommands();
    const off = addRemoteCommandListener((command) => {
      if (command.type === 'next') next();
      else if (command.type === 'previous') previous();
      else if (command.type === 'play') setIsPlaying(true);
      else if (command.type === 'pause') setIsPlaying(false);
      else if (command.type === 'toggle') setIsPlaying((p) => !p);
      else if (command.type === 'seek') {
        // The lock screen's bar is one ayah long, so its position is within the current ayah.
        const span = loaded.current?.audio.ayahs[live.current.ayahIndex];
        if (span) seek(span[0] / 1000 + Math.min(command.position, (span[1] - span[0]) / 1000)).then(() => setSeekTick((x) => x + 1));
      }
    });
    return () => {
      off();
      disableRemoteCommands();
    };
  }, [next, previous, seek]);

  const pause = useCallback(() => setIsPlaying(false), []);
  useEffect(() => {
    pauseHandler = pause;
    return () => {
      pauseHandler = null;
    };
  }, [pause]);

  const stop = useCallback(() => {
    request.current += 1;
    setIsPlaying(false);
    try {
      player.pause();
    } catch {
      // already stopped
    }
    clearNowPlaying();
    lockScreenOn.current = false;
    pendingSeek.current = null;
    setLoading(false);
    patch({ surahId: null, ayahIndex: 0 });
  }, [player, patch]);

  const value = useMemo<Recitation>(
    () => ({
      ready,
      surahId,
      ayahIndex,
      inBismillah: false,
      preparing: null,
      loading,
      error,
      isPlaying,
      reciter,
      repeat,
      autoplay,
      rate,
      playSurah: (id, index = 0) => start(id, index),
      goToAyah,
      next,
      previous,
      togglePlay: () => {
        // Nothing on the player yet (a fresh launch, or after an error): open where it left off.
        if (surahId && (!loaded.current || error)) {
          if (isPlaying && !error) setIsPlaying(false);
          else start(surahId, ayahIndex);
          return;
        }
        setIsPlaying((p) => !p);
      },
      pause,
      stop,
      setReciter: (id) => patch({ reciterId: id }),
      cycleRepeat: () => patch({ repeat: repeat === 'off' ? 'ayah' : repeat === 'ayah' ? 'surah' : 'off' }),
      setRepeat: (mode) => patch({ repeat: mode }),
      setAutoplay: (on) => patch({ autoplay: on }),
      setRate: (r) => patch({ rate: r }),
    }),
    [ready, surahId, ayahIndex, loading, error, isPlaying, reciter, repeat, autoplay, rate, start, goToAyah, next, previous, pause, stop, patch],
  );

  const audioNow = loaded.current?.audio;
  const span = audioNow?.ayahs[ayahIndex];
  const progress = useMemo<RecitationProgress>(() => {
    const from = span ? span[0] / 1000 : 0;
    const seconds = span ? (span[1] - span[0]) / 1000 : 0;
    return {
      currentTime: span ? Math.min(seconds, Math.max(0, status.currentTime - from)) : 0,
      duration: seconds,
      buffering: loading || status.isBuffering,
      word: audioNow && span ? wordAt(audioNow, ayahIndex, status.currentTime * 1000) : 0,
      seekTo: (fraction) => {
        if (span) seek(from + fraction * seconds).then(() => setSeekTick((x) => x + 1));
      },
    };
  }, [status.currentTime, status.isBuffering, loading, span, seek, audioNow, ayahIndex]);

  return (
    <Ctx.Provider value={value}>
      <ProgressCtx.Provider value={progress}>{children}</ProgressCtx.Provider>
    </Ctx.Provider>
  );
}

export function useRecitation(): Recitation {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRecitation must be used inside RecitationProvider');
  return v;
}

export function useRecitationProgress(): RecitationProgress {
  const v = useContext(ProgressCtx);
  if (!v) throw new Error('useRecitationProgress must be used inside RecitationProvider');
  return v;
}
