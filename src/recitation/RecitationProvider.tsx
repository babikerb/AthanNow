import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllPreloadedSources, preload, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { addNextTrackListener, addPreviousTrackListener, disableTrackCommands, enableTrackCommands } from 'lock-screen-track-controls';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getSurah } from '../data/surahs';
import { ayahAudioUrl, BISMILLAH_WORDS, hasBismillah, loadSurahText, loadWordTiming, type Ayah, type WordSegment } from './quranAudio';
import { getReciter, type Reciter } from './reciters';

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
  showTranslation: boolean;
  savedIds: number[];
}

const DEFAULTS: Saved = { surahId: null, ayahIndex: 0, reciterId: 'mishary', repeat: 'off', autoplay: true, rate: 1, showTranslation: true, savedIds: [] };

export interface Recitation {
  ready: boolean;
  surahId: number | null;
  ayahIndex: number;
  ayahs: Ayah[];
  /** True while the Bismillah plays before ayah 1. */
  inBismillah: boolean;
  /** Words hidden from the front of ayah 1's text because they are the Bismillah (shown above it instead). */
  bismillahWords: number;
  loading: boolean;
  error: string | null;
  isPlaying: boolean;
  reciter: Reciter;
  repeat: RepeatMode;
  autoplay: boolean;
  rate: number;
  showTranslation: boolean;
  savedIds: number[];
  /** Starts a surah (from ayah 1, or a given index) and plays it. */
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
  setAutoplay: (on: boolean) => void;
  setRate: (rate: number) => void;
  setShowTranslation: (on: boolean) => void;
  toggleSaved: (surahId: number) => void;
}

export interface RecitationProgress {
  currentTime: number;
  duration: number;
  buffering: boolean;
  /** [first, end) word of the displayed ayah being recited, or null without timing data. */
  activeWords: [number, number] | null;
  seekTo: (fraction: number) => void;
}

const Ctx = createContext<Recitation | null>(null);
const ProgressCtx = createContext<RecitationProgress | null>(null);

// Lets other audio in the app (the athan preview in Settings) pause the recitation first.
let pauseHandler: (() => void) | null = null;
export function pauseRecitation() {
  pauseHandler?.();
}

/**
 * iOS's media server can restart under pressure, and native calls made in that window throw
 * ("Server was dead...") instead of waiting. Those are transient, so retry with backoff, and give
 * up quietly once the request they belong to has been superseded.
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

const AUDIO_MODE = { playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' } as const;

async function startPlayback(player: AudioPlayer, aborted: () => boolean) {
  // Re-applied each time: the athan preview sets its own (foreground) mode.
  await setAudioModeAsync(AUDIO_MODE).catch(() => {});
  if (await retry(() => player.play(), aborted)) return;
  // A stale audio session survives plain retries; reactivating it first recovers.
  await setAudioModeAsync(AUDIO_MODE).catch(() => {});
  await retry(() => player.play(), aborted, 2);
}

export function RecitationProvider({ children }: { children: React.ReactNode }) {
  const [saved, setSaved] = useState<Saved>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [text, setText] = useState<{ surahId: number; ayahs: Ayah[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<{ key: string; map: Map<number, WordSegment[]> | null } | null>(null);
  // Whether the Bismillah should still play before ayah 1 on this arrival.
  const [bismillahDue, setBismillahDue] = useState(false);
  // Bumped on every deliberate arrival at an ayah, so replaying the same ayah is a new request.
  const [visit, setVisit] = useState(0);
  const [textAttempt, setTextAttempt] = useState(0);

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

  // ---- Surah text and word timing ----
  useEffect(() => {
    if (!surahId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadSurahText(surahId)
      .then((ayahs) => {
        if (cancelled) return;
        setText({ surahId, ayahs });
        setSaved((s) => (s.surahId === surahId && s.ayahIndex >= ayahs.length ? { ...s, ayahIndex: 0 } : s));
      })
      .catch(() => !cancelled && setError('Could not load this surah. Check your connection and try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [surahId, textAttempt]);

  const timingKey = surahId ? `${reciter.edition}:${surahId}` : '';
  useEffect(() => {
    if (!surahId) return;
    let cancelled = false;
    loadWordTiming(surahId, reciter).then((map) => !cancelled && setTiming({ key: timingKey, map }));
    return () => {
      cancelled = true;
    };
  }, [timingKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const ayahs = text && text.surahId === surahId ? text.ayahs : [];
  const ayah = ayahs[ayahIndex];
  const inBismillah = !!surahId && ayahIndex === 0 && bismillahDue && hasBismillah(surahId);
  const bismillahWords = !!surahId && ayahIndex === 0 && hasBismillah(surahId) ? BISMILLAH_WORDS : 0;
  const url = !ayah ? null : inBismillah ? ayahAudioUrl(reciter, 1) : ayahAudioUrl(reciter, ayah.number);
  const requestKey = url ? `${surahId}:${ayahIndex}:${reciter.id}:${inBismillah ? 'b' : 'a'}:${visit}` : null;

  // ---- Player ----
  // Created once with no source; sources change only through replace(), as Expo documents for
  // switching tracks (a changing source prop would rebuild the native player mid-transition).
  // keepAudioSessionActive keeps the lock-screen controls answering after an in-app pause.
  const player = useAudioPlayer(null, { updateInterval: 50, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const loadedKey = useRef<string | null>(null);
  // Set once replace() has resolved: statuses before that still describe the previous clip, and a
  // stale "finished" from it must not end the new one.
  const armedKey = useRef<string | null>(null);
  const finishedKey = useRef<string | null>(null);
  const lockScreenOn = useRef(false);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  const surah = surahId ? getSurah(surahId) : undefined;
  const nowPlaying = useMemo(
    () =>
      surah && ayah
        ? { title: `${surah.transliteration}: ${inBismillah ? 'Bismillah' : `Ayah ${ayah.numberInSurah}`}`, artist: reciter.name, albumTitle: 'AthanNow' }
        : null,
    [surah, ayah, inBismillah, reciter.name],
  );

  useEffect(() => {
    if (!url || !requestKey || loadedKey.current === requestKey) return;
    loadedKey.current = requestKey;
    armedKey.current = null;
    finishedKey.current = null;
    let cancelled = false;
    const aborted = () => cancelled || loadedKey.current !== requestKey;
    (async () => {
      if (!(await retry(() => player.replace({ uri: url }), aborted))) {
        if (!aborted()) {
          loadedKey.current = null;
          setError('Could not play this recitation. Check your connection or try another reciter.');
          setIsPlaying(false);
        }
        return;
      }
      armedKey.current = requestKey;
      setError(null);
      try {
        player.setPlaybackRate(rate);
      } catch {
        // keeps the default rate
      }
      if (playingRef.current) startPlayback(player, aborted);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock screen and Control Center, from the first play on. The player is registered once: each
  // registration adds another set of play/pause handlers natively, so after that only the track info
  // is updated, every ayah.
  useEffect(() => {
    if (!nowPlaying || !status.isLoaded || loadedKey.current !== requestKey) return;
    if (!lockScreenOn.current && !isPlaying) return;
    try {
      if (!lockScreenOn.current) {
        player.setActiveForLockScreen(true, nowPlaying, { showSeekForward: false, showSeekBackward: false });
        lockScreenOn.current = true;
      } else {
        player.updateLockScreenMetadata(nowPlaying);
      }
    } catch {
      // the next ayah tries again
    }
  }, [nowPlaying, status.isLoaded, requestKey, player, isPlaying]);

  useEffect(() => {
    try {
      player.setPlaybackRate(rate);
    } catch {
      // applied on the next load
    }
  }, [rate, player]);

  // Play/pause intent -> player.
  useEffect(() => {
    if (!url || loadedKey.current !== requestKey) return;
    let cancelled = false;
    if (isPlaying && !status.playing) startPlayback(player, () => cancelled);
    if (!isPlaying && status.playing) retry(() => player.pause(), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player -> intent, for pauses that didn't come from the app (lock screen, a call, headphones).
  // A clip running out also stops the player, which isn't a pause: that's handled as a finish.
  useEffect(() => {
    if (!status.isLoaded || armedKey.current !== requestKey || status.playing === isPlaying) return;
    const atEnd = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.3);
    if (!status.playing && atEnd) return;
    setIsPlaying(status.playing);
  }, [status.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload the next two ayahs once the current one is loaded, so moving on has no gap. Never the
  // current URL: replace() and preload() share one native registry, and racing them on the same
  // file crashed in Tilawah.
  useEffect(() => {
    if (!status.isLoaded || !ayahs.length) return;
    let cancelled = false;
    (async () => {
      const upcoming = inBismillah ? [ayahIndex, ayahIndex + 1] : [ayahIndex + 1, ayahIndex + 2];
      for (const i of upcoming) {
        const a = ayahs[i];
        if (cancelled || !a) continue;
        await preload({ uri: ayahAudioUrl(reciter, a.number) }).catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey, status.isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearAllPreloadedSources().catch(() => {});
  }, [surahId, reciter.id]);

  const arrive = useCallback(
    (index: number, p: Partial<Saved> = {}) => {
      setBismillahDue(index === 0);
      setVisit((v) => v + 1);
      patch({ ...p, ayahIndex: index });
    },
    [patch],
  );

  // A clip finished: the Bismillah hands over to ayah 1; otherwise repeat, advance, or move on.
  useEffect(() => {
    if (!status.didJustFinish || !requestKey || armedKey.current !== requestKey || finishedKey.current === requestKey) return;
    finishedKey.current = requestKey;
    if (inBismillah) {
      setBismillahDue(false);
    } else if (repeat === 'ayah') {
      const aborted = () => loadedKey.current !== requestKey;
      retry(() => player.seekTo(0), aborted).then((ok) => {
        if (ok) {
          finishedKey.current = null;
          startPlayback(player, aborted);
        }
      });
    } else if (ayahIndex < ayahs.length - 1) {
      arrive(ayahIndex + 1);
    } else if (repeat === 'surah') {
      arrive(0);
    } else if (autoplay && surahId && surahId < 114) {
      arrive(0, { surahId: surahId + 1 });
    } else {
      setIsPlaying(false);
    }
  }, [status.didJustFinish, requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Actions ----
  const lengthRef = useRef(0);
  lengthRef.current = ayahs.length;
  const indexRef = useRef(ayahIndex);
  indexRef.current = ayahIndex;

  const bismillahRef = useRef(inBismillah);
  bismillahRef.current = inBismillah;

  // Next during the Bismillah goes to ayah 1 itself.
  const next = useCallback(() => {
    if (bismillahRef.current) setBismillahDue(false);
    else if (indexRef.current < lengthRef.current - 1) arrive(indexRef.current + 1);
  }, [arrive]);
  const previous = useCallback(() => arrive(Math.max(0, indexRef.current - 1)), [arrive]);

  useEffect(() => {
    enableTrackCommands();
    const offNext = addNextTrackListener(next);
    const offPrev = addPreviousTrackListener(previous);
    return () => {
      offNext();
      offPrev();
      disableTrackCommands();
    };
  }, [next, previous]);

  const pause = useCallback(() => setIsPlaying(false), []);
  useEffect(() => {
    pauseHandler = pause;
    return () => {
      pauseHandler = null;
    };
  }, [pause]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    try {
      player.pause();
      player.clearLockScreenControls();
    } catch {
      // already stopped
    }
    lockScreenOn.current = false;
    loadedKey.current = null;
    armedKey.current = null;
    patch({ surahId: null, ayahIndex: 0 });
  }, [player, patch]);

  const value = useMemo<Recitation>(
    () => ({
      ready,
      surahId,
      ayahIndex,
      ayahs,
      inBismillah,
      bismillahWords,
      loading,
      error,
      isPlaying,
      reciter,
      repeat,
      autoplay,
      rate,
      showTranslation: saved.showTranslation,
      savedIds: saved.savedIds,
      playSurah: (id, index = 0) => {
        setIsPlaying(true);
        arrive(index, { surahId: id });
      },
      goToAyah: (index) => arrive(index),
      next,
      previous,
      togglePlay: () => {
        if (error && surahId) {
          // Retry after a failure: the text if it never loaded, otherwise the same ayah.
          setError(null);
          setIsPlaying(true);
          if (!ayahs.length) setTextAttempt((n) => n + 1);
          else arrive(ayahIndex);
          return;
        }
        setIsPlaying((p) => !p);
      },
      pause,
      stop,
      setReciter: (id) => patch({ reciterId: id }),
      cycleRepeat: () => patch({ repeat: repeat === 'off' ? 'ayah' : repeat === 'ayah' ? 'surah' : 'off' }),
      setAutoplay: (on) => patch({ autoplay: on }),
      setRate: (r) => patch({ rate: r }),
      setShowTranslation: (on) => patch({ showTranslation: on }),
      toggleSaved: (id) => setSaved((s) => ({ ...s, savedIds: s.savedIds.includes(id) ? s.savedIds.filter((x) => x !== id) : [...s.savedIds, id] })),
    }),
    [ready, surahId, ayahIndex, ayahs, inBismillah, bismillahWords, loading, error, isPlaying, reciter, repeat, autoplay, rate, saved.showTranslation, saved.savedIds, arrive, next, previous, pause, stop, patch],
  );

  const timingMap = timing && timing.key === timingKey ? timing.map : null;
  const current = armedKey.current === requestKey;
  const progress = useMemo<RecitationProgress>(() => {
    let activeWords: [number, number] | null = null;
    const segments = !inBismillah && current && ayah ? timingMap?.get(ayah.numberInSurah) : undefined;
    if (segments?.length) {
      // The latest word to have started stays lit through the small gaps between words, and the
      // first word is lit during any lead-in, so something is always highlighted.
      const ms = status.currentTime * 1000;
      let seg = segments[0];
      for (const s of segments) if (s[2] <= ms && s[2] >= seg[2]) seg = s;
      // Timing indices count from the ayah's first spoken word, which excludes the written Bismillah.
      activeWords = [seg[0], seg[1]];
    }
    return {
      currentTime: current ? status.currentTime : 0,
      duration: current ? status.duration : 0,
      buffering: status.isBuffering || (!!url && !status.isLoaded),
      activeWords,
      seekTo: (fraction) => {
        if (current && status.duration > 0) retry(() => player.seekTo(fraction * status.duration), () => loadedKey.current !== requestKey);
      },
    };
  }, [status.currentTime, status.duration, status.isBuffering, status.isLoaded, current, inBismillah, ayah, timingMap, url, player, requestKey]);

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
