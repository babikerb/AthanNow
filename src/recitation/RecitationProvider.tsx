import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { addRemoteCommandListener, clearNowPlaying, disableRemoteCommands, enableRemoteCommands, setNowPlaying } from 'lock-screen-track-controls';
import { Image } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getSurah } from '../data/surahs';
import { fetchClip, hasClip, trimClips } from './clipCache';
import { ayahNumber, BISMILLAH_WORDS, hasBismillah, loadSurahText, loadWordTiming, type Ayah, type WordSegment } from './quranAudio';
import { getReciter, type Reciter } from './reciters';
import { buildTrack, clearTracks, deleteTrack, markAt, type Track } from './track';

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
  /** Clips downloaded so far before playback starts, or null when nothing is being waited for. */
  preparing: { done: number; total: number } | null;
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

// A clip that is meant to be playing but hasn't moved for this long is reloaded, twice at most.
const STALL_MS = 7000;
// Playback starts once the clip and this many after it are on the device (a whole surah up to
// SHORT_SURAH ayahs), or after PREPARE_MS, when whatever is missing streams instead.
const FIRST_CLIPS = 10;
const SHORT_SURAH = 20;
const PREPARE_MS = 20000;
const PREPARE_WORKERS = 5;
const BACKGROUND_WORKERS = 3;
// Across each join the volume dips, so one recording's room sound doesn't cut straight to the next:
// down over FADE_OUT_S to FADE_FLOOR, back up over FADE_IN_S. Short enough not to touch the words.
const FADE_OUT_S = 0.25;
const FADE_IN_S = 0.15;
const FADE_FLOOR = 0.1;
// A track joins up to this many ayahs, which keeps building one quick enough to do on a tap.
const TRACK_AYAHS = 60;
// With this little of a track left, the next is built from whatever has downloaded.
const NEXT_TRACK_LEAD_S = 20;

/** The end of the run of downloaded ayahs starting at `from`, at most one track long. */
function contiguousEnd(reciter: Reciter, surahId: number, from: number, total: number): number {
  const limit = Math.min(total, from + TRACK_AYAHS);
  let end = from;
  while (end < limit && hasClip(reciter, ayahNumber(surahId, end))) end += 1;
  return end;
}
const MAX_RELOADS = 2;

const ARTWORK = Image.resolveAssetSource(require('../../assets/icon.png')).uri;

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
  const [preparing, setPreparingState] = useState<{ done: number; total: number } | null>(null);
  const preparingRef = useRef(false);
  const setPreparing = useCallback((p: { done: number; total: number } | null) => {
    preparingRef.current = !!p;
    setPreparingState(p);
  }, []);

  const { surahId, ayahIndex, reciterId, repeat, autoplay, rate } = saved;
  const reciter = getReciter(reciterId);
  const patch = useCallback((p: Partial<Saved>) => setSaved((s) => ({ ...s, ...p })), []);

  useEffect(() => {
    AsyncStorage.getItem(STATE_KEY)
      .then((raw) => {
        if (!raw) return;
        const restored = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) };
        setSaved(restored);
        // Resuming at the top of a surah opens with the Bismillah, like starting it fresh.
        setBismillahDue(restored.ayahIndex === 0);
      })
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
  // Audio doesn't wait for the text: the clip's number comes from the surah list.
  const totalAyahs = surahId ? (getSurah(surahId)?.totalVerses ?? 0) : 0;
  // Only a deliberate move changes this: the ayah advancing inside a track doesn't.
  const requestKey = surahId && ayahIndex < totalAyahs ? `${surahId}:${reciter.id}:${visit}` : null;

  // ---- Player ----
  // Created once with no source; sources change only through replace(), as Expo documents for
  // switching tracks (a changing source prop would rebuild the native player mid-transition).
  // keepAudioSessionActive keeps the lock-screen controls answering after an in-app pause.
  const player = useAudioPlayer(null, { updateInterval: 30, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);
  const loadedKey = useRef<string | null>(null);
  // Statuses right after replace() can still describe the previous track (a stale "finished" would
  // end the new one at once), so a request is armed only by the first status that isn't a finish.
  const pendingArm = useRef<string | null>(null);
  const armedKey = useRef<string | null>(null);
  const handedOff = useRef<string | null>(null);
  const lockScreenOn = useRef(false);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  // The joined audio on the player, the one built to follow it, and the clip last seen playing.
  const trackRef = useRef<Track | null>(null);
  const nextRef = useRef<Track | null>(null);
  const lastMark = useRef(0);
  const gainRef = useRef(1);
  const [trackId, setTrackId] = useState(0);

  const surah = surahId ? getSurah(surahId) : undefined;
  const nowPlaying = useMemo(
    () =>
      surah ? { title: `${surah.transliteration}: ${inBismillah ? 'Bismillah' : `Ayah ${ayahIndex + 1}`}`, artist: reciter.name, album: 'AthanNow' } : null,
    [surah, ayahIndex, inBismillah, reciter.name],
  );

  const timingMap = timing && timing.key === timingKey ? timing.map : null;

  /** Puts a track on the player. Returns false if the player refused it. */
  const load = useCallback(
    (key: string, track: Track) => {
      loadedKey.current = key;
      armedKey.current = null;
      pendingArm.current = key;
      handedOff.current = null;
      try {
        player.replace({ uri: track.uri });
        player.setPlaybackRate(rate);
        player.volume = 1;
        gainRef.current = 1;
      } catch {
        return false;
      }
      const old = trackRef.current;
      trackRef.current = track;
      lastMark.current = track.marks[0].index;
      setTrackId((n) => n + 1);
      setTimeout(() => deleteTrack(old), 3000);
      return true;
    },
    [player, rate],
  );

  // useAudioPlayer builds a new native player if its options change (a code reload does it too).
  // Nothing is loaded on a new one, so forget what the old one had.
  useEffect(() => {
    loadedKey.current = null;
    armedKey.current = null;
    pendingArm.current = null;
    lockScreenOn.current = false;
    trackRef.current = null;
    nextRef.current = null;
  }, [player]);

  // Bumped to force the current request to load again (stall recovery).
  const [reload, setReload] = useState(0);

  // A new request (a surah, a jump to an ayah, a reciter): download what's needed, join it, play it.
  useEffect(() => {
    if (!requestKey || !surahId) {
      setPreparing(null);
      return;
    }
    if (loadedKey.current === requestKey) return;
    let cancelled = false;
    // Claimed before the first attempt: retry() checks aborted() first, and an unclaimed request
    // would count as superseded and never load.
    loadedKey.current = requestKey;
    const aborted = () => cancelled || loadedKey.current !== requestKey;
    armedKey.current = null;
    deleteTrack(nextRef.current);
    nextRef.current = null;
    (async () => {
      const from = ayahIndex;
      const wanted = repeat === 'ayah' ? from + 1 : totalAyahs <= SHORT_SURAH ? totalAyahs : Math.min(totalAyahs, from + FIRST_CLIPS);
      const needed = inBismillah ? [1] : [];
      for (let i = from; i < wanted; i++) needed.push(ayahNumber(surahId, i));
      const missing = needed.filter((n) => !hasClip(reciter, n));
      if (missing.length) {
        // The old recitation stops while the first clips come down.
        try {
          player.pause();
        } catch {
          // nothing was playing
        }
        let done = 0;
        setPreparing({ done, total: missing.length });
        const queue = [...missing];
        const worker = async () => {
          for (let n = queue.shift(); n != null && !aborted(); n = queue.shift()) {
            await fetchClip(reciter, n);
            done += 1;
            if (!aborted()) setPreparing({ done, total: missing.length });
          }
        };
        await Promise.race([
          Promise.all(Array.from({ length: PREPARE_WORKERS }, worker)),
          new Promise((r) => setTimeout(r, PREPARE_MS)),
        ]);
        if (aborted()) return;
      }
      setPreparing(null);
      const end = repeat === 'ayah' ? Math.min(contiguousEnd(reciter, surahId, from, totalAyahs), from + 1) : contiguousEnd(reciter, surahId, from, totalAyahs);
      const track = end > from ? await buildTrack(reciter, surahId, from, end, inBismillah && hasClip(reciter, 1)).catch(() => null) : null;
      if (aborted()) {
        deleteTrack(track);
        return;
      }
      const ok = !!track && (await retry(() => {
        if (!load(requestKey, track)) throw new Error('replace failed');
      }, aborted));
      if (!ok) {
        if (!aborted()) {
          loadedKey.current = null;
          setError('Could not load this recitation. Check your connection and try again.');
          setIsPlaying(false);
        }
        return;
      }
      setError(null);
      if (playingRef.current) startPlayback(player, aborted);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey, player, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  // Builds the track that follows this one, as soon as all of it is downloaded, or with whatever is
  // ready when this one is about to run out.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !surahId || track.surahId !== surahId || track.end >= totalAyahs || repeat === 'ayah') return;
    let cancelled = false;
    let building = false;
    const id = setInterval(async () => {
      if (nextRef.current || building) return;
      const end = contiguousEnd(reciter, surahId, track.end, totalAyahs);
      const last = track.marks[track.marks.length - 1];
      const left = last.start + last.seconds - player.currentTime;
      if (end <= track.end || (end < Math.min(totalAyahs, track.end + TRACK_AYAHS) && left > NEXT_TRACK_LEAD_S)) return;
      building = true;
      const next = await buildTrack(reciter, surahId, track.end, end, false).catch(() => null);
      building = false;
      if (cancelled) deleteTrack(next);
      else nextRef.current = next;
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [trackId, repeat]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watchdog: if the track should be playing but its position hasn't moved, load it fresh. After
  // MAX_RELOADS, say so.
  const watch = useRef({ key: '', time: -1, since: 0, reloads: 0 });
  useEffect(() => {
    if (!isPlaying || !requestKey) return;
    const id = setInterval(() => {
      const now = Date.now();
      const time = player.currentTime;
      const w = watch.current;
      if (preparingRef.current) {
        w.since = now;
        return;
      }
      if (w.key !== requestKey) {
        watch.current = { key: requestKey, time, since: now, reloads: 0 };
        return;
      }
      if (time !== w.time) {
        w.time = time;
        w.since = now;
        return;
      }
      if (now - w.since < STALL_MS) return;
      if (w.reloads >= MAX_RELOADS) {
        setError('This recitation is not loading. Check your connection and try again.');
        setIsPlaying(false);
        return;
      }
      w.reloads += 1;
      w.since = now;
      loadedKey.current = null;
      setReload((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isPlaying, requestKey, player]);

  // What the status listener needs, without waiting for a render.
  const live = useRef({ surahId, totalAyahs, repeat, autoplay, requestKey });
  live.current = { surahId, totalAyahs, repeat, autoplay, requestKey };
  const arriveRef = useRef<(index: number, p?: Partial<Saved>, bismillah?: boolean) => void>(() => {});

  /**
   * Follows the track from the native status event: as playback crosses from one clip into the next
   * the current ayah moves on (the audio itself just keeps running), and when the track ends the next
   * one goes on in the same tick, without waiting for a render.
   */
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      const L = live.current;
      if (pendingArm.current && pendingArm.current === loadedKey.current && !st.didJustFinish) {
        armedKey.current = pendingArm.current;
        pendingArm.current = null;
      }
      const key = armedKey.current;
      const track = trackRef.current;
      if (!key || key !== L.requestKey || !track) return;

      if (!st.didJustFinish) {
        const mark = markAt(track, st.currentTime);
        const fadeIn = mark === track.marks[0] ? 1 : (st.currentTime - mark.start) / FADE_IN_S;
        const fadeOut = (mark.start + mark.seconds - st.currentTime) / FADE_OUT_S;
        const gain = Math.max(FADE_FLOOR, Math.min(1, fadeIn, fadeOut));
        if (gain !== gainRef.current) {
          gainRef.current = gain;
          player.volume = gain;
        }
        if (mark.index === lastMark.current) return;
        const previous = lastMark.current;
        lastMark.current = mark.index;
        // Repeat was switched on mid-track: go back and loop the ayah that just ended.
        if (L.repeat === 'ayah' && previous >= 0) arriveRef.current(previous, {}, false);
        else {
          setBismillahDue(false);
          patch({ ayahIndex: mark.index });
        }
        return;
      }

      if (handedOff.current === key || !playingRef.current) return;
      handedOff.current = key;
      const final = track.marks[track.marks.length - 1];
      if (L.repeat === 'ayah') {
        if (track.marks.length > 1) {
          arriveRef.current(final.index, {}, false);
          return;
        }
        const aborted = () => loadedKey.current !== key;
        retry(() => player.seekTo(0), aborted).then((ok) => {
          if (!ok) return;
          handedOff.current = null;
          startPlayback(player, aborted);
        });
        return;
      }
      const next = nextRef.current;
      nextRef.current = null;
      if (next && next.surahId === L.surahId && load(key, next)) {
        try {
          player.play();
        } catch {
          startPlayback(player, () => loadedKey.current !== key);
        }
        patch({ ayahIndex: next.marks[0].index });
      } else if (track.end < L.totalAyahs) arriveRef.current(track.end);
      else if (L.repeat === 'surah') arriveRef.current(0);
      else if (L.autoplay && L.surahId && L.surahId < 114) arriveRef.current(0, { surahId: L.surahId + 1 });
      else setIsPlaying(false);
    });
    return () => sub.remove();
  }, [player, load, patch]);

  // Lock screen and Control Center, from the first play on: the current ayah with its own time.
  // Sent on each change only; iOS runs the bar itself in between. expo-audio's own lock screen
  // support stays off, because it would show the joined track and its full length instead.
  const [seekTick, setSeekTick] = useState(0);
  useEffect(() => {
    const track = trackRef.current;
    if (!nowPlaying || !track || (!lockScreenOn.current && !isPlaying)) return;
    lockScreenOn.current = true;
    const target = inBismillah ? -1 : ayahIndex;
    const mark = track.marks.find((m) => m.index === target) ?? markAt(track, player.currentTime);
    const elapsed = Math.min(mark.seconds, Math.max(0, player.currentTime - mark.start));
    setNowPlaying({ ...nowPlaying, duration: mark.seconds, elapsed, rate: isPlaying ? rate : 0, artwork: ARTWORK });
  }, [nowPlaying, isPlaying, rate, trackId, seekTick, player]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      player.setPlaybackRate(rate);
    } catch {
      // applied on the next load
    }
  }, [rate, player]);

  // Play/pause intent -> player.
  useEffect(() => {
    if (!requestKey || loadedKey.current !== requestKey || preparingRef.current || !trackRef.current) return;
    let cancelled = false;
    if (isPlaying && !status.playing) startPlayback(player, () => cancelled);
    if (!isPlaying && status.playing) retry(() => player.pause(), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Player -> intent, for pauses that didn't come from the app (lock screen, a call, headphones).
  // A track running out also stops the player, which isn't a pause: the listener deals with it.
  useEffect(() => {
    if (!status.isLoaded || armedKey.current !== requestKey || handedOff.current === requestKey || status.playing === isPlaying) return;
    if (!status.playing && status.didJustFinish) return;
    setIsPlaying(status.playing);
  }, [status.playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // The rest of the surah downloads while it plays, then the start of the next one for autoplay.
  useEffect(() => {
    if (!surahId) return;
    let cancelled = false;
    (async () => {
      await fetchClip(reciter, 1);
      let i = ayahIndex;
      const worker = async () => {
        while (!cancelled && i < totalAyahs) await fetchClip(reciter, ayahNumber(surahId, i++));
      };
      await Promise.all(Array.from({ length: BACKGROUND_WORKERS }, worker));
      const following = getSurah(surahId + 1);
      for (let n = 0; following && n < Math.min(FIRST_CLIPS, following.totalVerses) && !cancelled; n++) {
        await fetchClip(reciter, ayahNumber(following.id, n));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    trimClips();
    clearTracks();
  }, []);

  const arrive = useCallback(
    (index: number, p: Partial<Saved> = {}, bismillah = index === 0) => {
      setBismillahDue(bismillah);
      setVisit((v) => v + 1);
      patch({ ...p, ayahIndex: index });
    },
    [patch],
  );
  arriveRef.current = arrive;

  // ---- Actions ----
  const lengthRef = useRef(0);
  lengthRef.current = totalAyahs;
  const indexRef = useRef(ayahIndex);
  indexRef.current = ayahIndex;

  const bismillahRef = useRef(inBismillah);
  bismillahRef.current = inBismillah;

  // Next during the Bismillah goes to ayah 1 itself.
  const next = useCallback(() => {
    if (bismillahRef.current) arrive(0, {}, false);
    else if (indexRef.current < lengthRef.current - 1) arrive(indexRef.current + 1);
  }, [arrive]);
  const previous = useCallback(() => arrive(Math.max(0, indexRef.current - 1)), [arrive]);

  useEffect(() => {
    enableRemoteCommands();
    const off = addRemoteCommandListener((command) => {
      if (command.type === 'next') next();
      else if (command.type === 'previous') previous();
      else if (command.type === 'play') setIsPlaying(true);
      else if (command.type === 'pause') setIsPlaying(false);
      else if (command.type === 'toggle') setIsPlaying((p) => !p);
      else if (trackRef.current && command.type === 'seek') {
        // The lock screen's bar is one ayah long, so its position is within the current ayah.
        const mark = markAt(trackRef.current, player.currentTime);
        player
          .seekTo(mark.start + Math.min(command.position, mark.seconds))
          .then(() => setSeekTick((n) => n + 1))
          .catch(() => {});
      }
    });
    return () => {
      off();
      disableRemoteCommands();
    };
  }, [next, previous, player]);

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
    } catch {
      // already stopped
    }
    clearNowPlaying();
    lockScreenOn.current = false;
    loadedKey.current = null;
    armedKey.current = null;
    pendingArm.current = null;
    deleteTrack(nextRef.current);
    nextRef.current = null;
    patch({ surahId: null, ayahIndex: 0 });
  }, [player, patch]);

  const value = useMemo<Recitation>(
    () => ({
      ready,
      surahId,
      ayahIndex,
      ayahs,
      inBismillah,
      preparing,
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
    [ready, surahId, ayahIndex, ayahs, inBismillah, preparing, bismillahWords, loading, error, isPlaying, reciter, repeat, autoplay, rate, saved.showTranslation, saved.savedIds, arrive, next, previous, pause, stop, patch],
  );

  const current = armedKey.current === requestKey;
  const progress = useMemo<RecitationProgress>(() => {
    const track = trackRef.current;
    const mark = track && current ? markAt(track, status.currentTime) : null;
    const time = mark ? Math.max(0, status.currentTime - mark.start) : 0;
    let activeWords: [number, number] | null = null;
    const playing = mark && mark.index >= 0 ? ayahs[mark.index] : undefined;
    const segments = playing ? timingMap?.get(playing.numberInSurah) : undefined;
    if (segments?.length) {
      // The latest word to have started stays lit through the small gaps between words, and the
      // first word is lit during any lead-in, so something is always highlighted.
      const ms = time * 1000;
      let seg = segments[0];
      for (const s of segments) if (s[2] <= ms && s[2] >= seg[2]) seg = s;
      // Timing indices count from the ayah's first spoken word, which excludes the written Bismillah.
      activeWords = [seg[0], seg[1]];
    }
    return {
      currentTime: time,
      duration: mark ? mark.seconds : 0,
      buffering: !!preparing || status.isBuffering || (!!requestKey && !status.isLoaded),
      activeWords,
      seekTo: (fraction) => {
        if (mark) retry(() => player.seekTo(mark.start + fraction * mark.seconds), () => loadedKey.current !== requestKey).then(() => setSeekTick((n) => n + 1));
      },
    };
  }, [status.currentTime, status.isBuffering, status.isLoaded, preparing, current, ayahs, timingMap, player, requestKey, trackId]);

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
