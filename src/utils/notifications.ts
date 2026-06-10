import * as Notifications from 'expo-notifications';

import { PrayerKey, Settings } from '../context/SettingsContext';
import { getPrayerTimes } from './prayerEngine';

/** How many days ahead to schedule. Prayer times shift daily, so we use exact
 *  DATE triggers and refresh this window whenever the app opens or settings change. */
const DAYS_AHEAD = 7;

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

  for (let offset = 0; offset < DAYS_AHEAD; offset++) {
    const day = new Date();
    day.setDate(now.getDate() + offset);
    const { listRows } = getPrayerTimes(coords, day, settings.calcMethod, settings.asrMadhab);

    for (const row of listRows) {
      const key = row.id as PrayerKey;
      const time = row.time;
      if (time <= now) continue;

      const mins = notifications.reminderMinutesBefore || 0;

      if (key !== 'sunrise') {
        // Athan notification per enabled prayer.
        if (notifications.athanEnabled[key]) {
          const fireAt = new Date(time.getTime() - mins * 60_000);
          if (fireAt > now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${PRAYER_LABELS[key]}`,
                body: mins > 0 ? `${PRAYER_LABELS[key]} is in ${mins} minutes.` : `It's time for ${PRAYER_LABELS[key]} prayer.`,
                // Custom adhan sound (bundled via the expo-notifications plugin); needs a build.
                sound: notifications.athanSound ? 'adhan.wav' : undefined,
                interruptionLevel: 'timeSensitive',
              },
              trigger: dateTrigger(fireAt),
            });
          }
        }
      } else {
        // Sunrise reminder (marks the end of Fajr time). Default tone, not the adhan.
        if (notifications.athanEnabled.sunrise) {
          const fireAt = new Date(time.getTime() - mins * 60_000);
          if (fireAt > now) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'Sunrise',
                body: mins > 0 ? `Sunrise is in ${mins} minutes (Fajr ends).` : 'The sun has risen. Fajr time has ended.',
                sound: 'default',
                interruptionLevel: 'timeSensitive',
              },
              trigger: dateTrigger(fireAt),
            });
          }
        }

        // Morning Quran reminder around sunrise.
        if (notifications.quranMorningEnabled) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Good morning',
              body: 'Start your day with the Quran.',
            },
            trigger: dateTrigger(time),
          });
        }
      }
    }
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
