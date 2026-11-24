import * as Notifications from 'expo-notifications';
import { athanVoice } from '../config/athanVoices';
import { QURAN_ENABLED } from '../config/features';

import { PrayerKey, Settings } from '../context/SettingsContext';
import { getPrayerTimes, lastThirdStart, prayerLabel } from './prayerEngine';

/** How many days ahead to schedule. Prayer times shift daily, so we use exact
 *  DATE triggers and refresh this window whenever the app opens or settings change.
 *  Exported so Settings' notification-transparency footer (plan §3.7) can state
 *  the real scheduling window instead of a hardcoded guess. */
export const DAYS_AHEAD = 7;

/** iOS keeps at most 64 pending local notifications and silently drops the rest.
 *  We schedule chronologically and stop before that ceiling so the SOONEST
 *  prayers always get both their reminder and their athan. Exported for the
 *  same reason as `DAYS_AHEAD` above. */
export const MAX_PENDING = 60;

/** How long before Jumu'ah its reminder comes. */
const JUMUAH_LEAD_MIN = 60;

/** Whether anything at all should be scheduled. */
export function anyNotificationEnabled(s: Settings): boolean {
  const n = s.notifications;
  return Object.values(n.athanEnabled).some(Boolean) || (QURAN_ENABLED && n.quranMorningEnabled) || n.jumuahEnabled || n.tahajjudEnabled;
}

export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/** Result of an `expo-notifications` permission check or request, surfaced
 *  verbatim (not collapsed to a boolean) so callers can implement the
 *  three-state ask/granted/permanently-denied flow (plan §4.2a). */
export interface NotificationPermissionState {
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
}

/** Checks the current notification permission without prompting. */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { status, canAskAgain };
}

/** Prompts for notification permission (shows the OS dialog only when the
 *  permission hasn't been permanently denied) and returns the result. */
export async function requestNotificationPermissionState(): Promise<NotificationPermissionState> {
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  return { status, canAskAgain };
}

interface Coords {
  latitude: number;
  longitude: number;
  /** Used only to format clock times in notification text; the caller already passes it. */
  timezone?: string;
}

function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

// Notification-text clock: no leading zero in 12-hour mode ('5:12 AM'), location timezone. Never throws: this runs inside the
// scheduler right after cancel-all, so a bad timezone string must degrade the text, not drop every notification.
function formatClock(date: Date, use24Hour: boolean, timeZone?: string): string {
  const base = { hour: use24Hour ? ('2-digit' as const) : ('numeric' as const), minute: '2-digit' as const, hour12: !use24Hour };
  try {
    return date.toLocaleTimeString([], { ...base, timeZone });
  } catch {
    try {
      return date.toLocaleTimeString([], base);
    } catch {
      return '';
    }
  }
}

/**
 * Cancels everything and re-schedules the next `DAYS_AHEAD` days of athan, Jumu'ah,
 * Tahajjud and morning-Quran notifications based on current settings + location.
 */
async function rescheduleNotificationsImpl(coords: Coords, settings: Settings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const { notifications } = settings;
  const now = new Date();
  const mins = notifications.reminderMinutesBefore || 0;

  // Two independent things per prayer:
  //   • the athan, fires at the prayer time (the per-prayer toggle), and
  //   • the reminder, an optional heads-up `mins` before (0 = off).
  // Both fire when both are on. Scheduled chronologically; we stop at the iOS cap.
  let count = 0;
  const schedule = async (content: Notifications.NotificationContentInput, date: Date): Promise<boolean> => {
    if (count >= MAX_PENDING) return false;
    if (date <= now) return true; // skip past times, but keep going
    count++;
    await Notifications.scheduleNotificationAsync({ content, trigger: dateTrigger(date) });
    return true;
  };

  for (let offset = 0; offset < DAYS_AHEAD && count < MAX_PENDING; offset++) {
    const day = new Date();
    day.setDate(now.getDate() + offset);
    const { listRows } = getPrayerTimes(coords, day, settings.calcMethod, settings.asrMadhab);

    // The night that ends at this day's Fajr.
    if (notifications.tahajjudEnabled) {
      const before = new Date(day);
      before.setDate(day.getDate() - 1);
      const maghrib = getPrayerTimes(coords, before, settings.calcMethod, settings.asrMadhab).listRows.find((x) => x.id === 'maghrib')!.time;
      const fajr = listRows.find((x) => x.id === 'fajr')!.time;
      const fajrClock = formatClock(fajr, settings.use24Hour, coords.timezone);
      await schedule(
        { title: 'Time for Tahajjud', body: `The last third of the night has begun. Fajr is at ${fajrClock}.`, sound: 'default', interruptionLevel: 'timeSensitive' },
        lastThirdStart(maghrib, fajr),
      );
    }

    for (const row of listRows) {
      if (count >= MAX_PENDING) break;
      const key = row.id as PrayerKey;
      const time = row.time;
      if (time <= now) continue;
      const sunriseRow = listRows.find((x) => x.id === 'sunrise');
      const sunriseClock = sunriseRow ? formatClock(sunriseRow.time, settings.use24Hour, coords.timezone) : '';
      const reminderAt = new Date(time.getTime() - mins * 60_000);
      // Copy only: clock times are shown in the user's 12/24-hour preference, in the location's timezone.
      const clock = formatClock(time, settings.use24Hour, coords.timezone);
      const label = prayerLabel(key, time, coords.timezone);
      if (notifications.jumuahEnabled && label === 'Jumu’ah') {
        await schedule(
          { title: 'Jumu’ah in an hour', body: `Jumu’ah is at ${clock}. A good time to get ready.`, sound: 'default', interruptionLevel: 'timeSensitive' },
          new Date(time.getTime() - JUMUAH_LEAD_MIN * 60_000),
        );
      }

      if (key !== 'sunrise') {
        if (notifications.athanEnabled[key]) {
          if (mins > 0) {
            await schedule(
              { title: `${label} in ${mins} min`, body: `${label} is at ${clock}.`, interruptionLevel: 'timeSensitive' },
              reminderAt,
            );
          }
          // The athan itself, exactly at prayer time (with the adhan sound if enabled).
          await schedule(
            {
              title: `${label} at ${clock}`,
              body:
                key === 'fajr'
                  ? `Fajr time has begun. It ends at sunrise${sunriseClock ? `, ${sunriseClock}` : ''}.`
                  : `${label} time has begun.`,
              sound: notifications.athanSound ? athanVoice(notifications.athanVoice).file : undefined,
              interruptionLevel: 'timeSensitive',
            },
            time,
          );
        }
      } else {
        // Sunrise (marks the end of Fajr time). Default tone, not the adhan.
        if (notifications.athanEnabled.sunrise) {
          if (mins > 0) {
            await schedule(
              { title: `Sunrise in ${mins} min`, body: `Fajr time ends at ${clock}.`, sound: 'default', interruptionLevel: 'timeSensitive' },
              reminderAt,
            );
          }
          await schedule(
            { title: `Sunrise at ${clock}`, body: 'Fajr time has ended.', sound: 'default', interruptionLevel: 'timeSensitive' },
            time,
          );
        }

        // Morning Quran reminder around sunrise.
        if (QURAN_ENABLED && notifications.quranMorningEnabled) {
          await schedule({ title: 'Morning Quran', body: 'A few minutes with the Quran before the day begins.' }, time);
        }
      }
    }
  }
}

async function cancelAllNotificationsImpl(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** What is currently scheduled, read-only (never schedules or cancels anything). */
export interface ScheduledSummary {
  count: number;
}

export async function getScheduledSummary(): Promise<ScheduledSummary> {
  // iOS reports our DATE triggers back as relative time-interval triggers, so an absolute end date cannot be read
  // back; the count of pending requests is what can be stated truthfully.
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return { count: all.length };
}

// One module-level queue for every call that mutates the pending schedule (cancel-all + ~60 awaited schedules). The
// scheduler hook already chains its own runs; callers outside it (Settings, background refresh) would otherwise be able
// to interleave with it and wipe or duplicate bookings.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export function rescheduleNotifications(coords: Coords, settings: Settings): Promise<void> {
  return serial(() => rescheduleNotificationsImpl(coords, settings));
}

export function cancelAllNotifications(): Promise<void> {
  return serial(cancelAllNotificationsImpl);
}
