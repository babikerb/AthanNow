import * as Notifications from 'expo-notifications';

import { PrayerKey, Settings } from '../context/SettingsContext';
import { getPrayerTimes } from './prayerEngine';

/** How many days ahead to schedule. Prayer times shift daily, so we use exact
 *  DATE triggers and refresh this window whenever the app opens or settings change. */
const DAYS_AHEAD = 7;

/** iOS keeps at most 64 pending local notifications and silently drops the rest.
 *  We schedule chronologically and stop before that ceiling so the SOONEST
 *  prayers always get both their reminder and their athan. */
const MAX_PENDING = 60;

const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

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

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

interface Coords {
  latitude: number;
  longitude: number;
}

function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date };
}

/**
 * Cancels everything and re-schedules the next `DAYS_AHEAD` days of athan,
 * jamaa, and morning-Quran notifications based on current settings + location.
 */
export async function rescheduleNotifications(coords: Coords, settings: Settings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const { notifications } = settings;
  const now = new Date();
  const mins = notifications.reminderMinutesBefore || 0;

  // Two independent things per prayer:
  //   • the athan — fires at the prayer time (the per-prayer toggle), and
  //   • the reminder — an optional heads-up `mins` before (0 = off).
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

    for (const row of listRows) {
      if (count >= MAX_PENDING) break;
      const key = row.id as PrayerKey;
      const time = row.time;
      if (time <= now) continue;
      const reminderAt = new Date(time.getTime() - mins * 60_000);

      if (key !== 'sunrise') {
        if (notifications.athanEnabled[key]) {
          if (mins > 0) {
            await schedule(
              { title: `${PRAYER_LABELS[key]} soon`, body: `${PRAYER_LABELS[key]} is in ${mins} minutes.`, interruptionLevel: 'timeSensitive' },
              reminderAt,
            );
          }
          // The athan itself, exactly at prayer time (with the adhan sound if enabled).
          await schedule(
            {
              title: `${PRAYER_LABELS[key]}`,
              body: `It's time for ${PRAYER_LABELS[key]} prayer.`,
              sound: notifications.athanSound ? 'adhan.wav' : undefined,
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
              { title: 'Sunrise soon', body: `Sunrise is in ${mins} minutes (Fajr ends).`, sound: 'default', interruptionLevel: 'timeSensitive' },
              reminderAt,
            );
          }
          await schedule(
            { title: 'Sunrise', body: 'The sun has risen. Fajr time has ended.', sound: 'default', interruptionLevel: 'timeSensitive' },
            time,
          );
        }

        // Morning Quran reminder around sunrise.
        if (notifications.quranMorningEnabled) {
          await schedule({ title: 'Good morning', body: 'Start your day with the Quran.' }, time);
        }
      }
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
