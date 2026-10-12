import { useEffect, useMemo, useState } from 'react';

import { useSettings } from '../context/SettingsContext';
import type { SkyStage } from '../design/tokens';
import { useLocation } from '../context/LocationContext';
import { formatCountdown, getCelestialConfig, getPrayerTimes } from '../utils/prayerEngine';
import { formatClock, localDayAnchor } from '../utils/time';

export interface WidgetRow {
  id: string;
  label: string;
  arabic: string;
  /** Formatted clock time in the user's 12/24-hour preference. */
  time: string;
  passed: boolean;
  /** The upcoming prayer (the one the hero counts down to). Matches the WidgetKit widget, which emphasises the next prayer. */
  next: boolean;
}

/** Everything a widget needs to draw itself. Pure data, so the same model can feed WidgetKit later. */
export interface WidgetModel {
  city: string;
  /** Prayer stage whose sky ramp is the background. */
  stage: SkyStage;
  nextLabel: string;
  nextTime: string;
  /** Countdown text to the next prayer, tabular (e.g. "1:12:04"). */
  countdown: string;
  /** 0..1 through the current prayer's window; null when it cannot be known. */
  progress: number | null;
  rows: WidgetRow[];
}

/**
 * Live model for in-app widgets, built the same way the Athan screen and the WidgetKit data writer build theirs.
 * Returns null until the saved location has been restored (so a preview never flashes the Mecca seed).
 * The day's prayer times are computed once per day/location/settings; only the countdown, progress and
 * passed/next flags are recomputed on the 1-second tick.
 */
export function useWidgetModel(): WidgetModel | null {
  const { location, cityName, hasRestored } = useLocation();
  const { calcMethod, asrMadhab, use24Hour } = useSettings();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tz = location?.timezone;
  const dayKey = localDayAnchor(now, tz).getTime();

  // Heavy part: once per (day, location, settings).
  const day = useMemo(() => {
    if (!location || !hasRestored) return null;
    const pt = getPrayerTimes(location, new Date(dayKey), calcMethod, asrMadhab);
    return {
      pt,
      rows: pt.listRows.map((r) => ({
        id: r.id,
        label: r.label,
        arabic: getCelestialConfig(r.id).arabicName,
        clock: formatClock(r.time, use24Hour, tz),
        at: r.time.getTime(),
      })),
      nextClock: formatClock(pt.nextPrayerTime, use24Hour, tz),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, location?.latitude, location?.longitude, tz, calcMethod, asrMadhab, use24Hour, hasRestored]);

  // Cheap part: every tick.
  if (!day) return null;
  const { pt } = day;
  const nowMs = now.getTime();
  const startMs = pt.listRows.find((r) => r.id === pt.currentPrayer)?.time.getTime();
  const total = startMs ? pt.nextPrayerTime.getTime() - startMs : 0;
  const progress = startMs && total > 0 ? Math.max(0, Math.min(1, (nowMs - startMs) / total)) : null;
  const nextId = pt.nextPrayer.toLowerCase();
  return {
    city: cityName,
    stage: pt.currentPrayer as SkyStage,
    nextLabel: pt.nextPrayer,
    nextTime: day.nextClock,
    countdown: formatCountdown(now, pt.nextPrayerTime),
    progress,
    rows: day.rows.map((r) => ({
      id: r.id,
      label: r.label,
      arabic: r.arabic,
      time: r.clock,
      next: r.id === nextId && r.at > nowMs,
      passed: r.at <= nowMs,
    })),
  };
}
