import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import {
  DEFAULT_SETTINGS,
  mergeSettings,
  SETTINGS_STORAGE_KEY,
  Settings,
} from '../context/SettingsContext';
import { AppLocation, LOCATION_STORAGE_KEY } from '../hooks/useLocation';
import { rescheduleNotifications } from './notifications';
import { refreshWidgetData } from './widgetData';

export const BACKGROUND_REFRESH_TASK = 'athannow-background-refresh';

function anyNotificationEnabled(s: Settings): boolean {
  const n = s.notifications;
  return Object.values(n.athanEnabled).some(Boolean) || n.quranMorningEnabled;
}

/**
 * Re-rolls the 7-day notification window and the widget's week of times while the
 * app is closed. Local notifications use exact DATE triggers and iOS caps pending
 * ones at 64, so a single app open only covers ~4-5 days; without this top-up,
 * athans stop firing if the app isn't opened for a while. iOS runs this
 * opportunistically (BGProcessingTask) — best-effort, not a hard guarantee.
 *
 * Defined at module scope (not in a component) so the headless JS runtime can find
 * it; the task reconstructs location + settings straight from AsyncStorage.
 */
TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  try {
    const [locRaw, setRaw] = await Promise.all([
      AsyncStorage.getItem(LOCATION_STORAGE_KEY),
      AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
    ]);
    const location: AppLocation | null = locRaw ? JSON.parse(locRaw) : null;
    const settings = mergeSettings(DEFAULT_SETTINGS, setRaw ? JSON.parse(setRaw) : null);
    if (!location) return BackgroundTask.BackgroundTaskResult.Success;

    // Keep the widget's week of times fresh regardless of notification settings.
    await refreshWidgetData(
      location,
      location.city,
      settings.calcMethod,
      settings.asrMadhab,
      settings.use24Hour,
    );

    // Only touch the notification schedule when something is enabled and permission
    // was already granted — we can't prompt for permission from the background.
    if (anyNotificationEnabled(settings)) {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        await rescheduleNotifications(location, settings);
      }
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Registers the periodic background refresh (idempotent; no-ops where unsupported). */
export async function registerBackgroundRefresh(): Promise<void> {
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
    if (!registered) {
      // minimumInterval is only a hint; iOS schedules opportunistically. A few hours
      // is plenty given the schedule already covers several days ahead.
      await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, { minimumInterval: 360 });
    }
  } catch {
    // Background tasks unavailable (e.g. Expo Go / unsupported environment) — ignore.
  }
}
