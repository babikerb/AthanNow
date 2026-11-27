import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { clearNowPlaying } from 'lock-screen-track-controls';
import { DevSettings } from 'react-native';
import SharedGroupPreferences from 'react-native-shared-group-preferences';

import { pauseRecitation } from '../recitation/RecitationProvider';
import { cancelAllNotifications } from './notifications';

const APP_GROUP = 'group.com.bbabiker.AthanNow';
const WIDGET_KEY = 'athannow_widget';

/** Deletes everything inside a directory, keeping the directory itself. */
function emptyDirectory(dir: Directory) {
  try {
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      try {
        entry.delete();
      } catch {
        // in use or protected by the system: left
      }
    }
  } catch {
    // unreadable: nothing to do
  }
}

/**
 * Wipes everything the app has kept, then starts it again from nothing, as on a fresh install:
 * the recitation stopped and off the lock screen; every scheduled and delivered notification; all
 * saved data (settings, onboarding, location, bookmarks, goals and progress, reading place, the
 * recitation's place, reciter and cached timings); the widget's data; and every downloaded or
 * cached file (mushaf pages, page fonts, images). Restarting is what clears what the running app
 * still holds in memory, which would otherwise be saved straight back.
 */
export async function resetApp(): Promise<void> {
  try {
    pauseRecitation();
    clearNowPlaying();
  } catch {
    // nothing playing
  }
  await cancelAllNotifications().catch(() => {});
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  await AsyncStorage.clear().catch(() => {});
  // An empty value reads as no data, as before the app first ran.
  await SharedGroupPreferences.setItem(WIDGET_KEY, '', APP_GROUP).catch(() => {});
  await Image.clearDiskCache().catch(() => {});
  await Image.clearMemoryCache().catch(() => {});
  emptyDirectory(Paths.document);
  emptyDirectory(Paths.cache);

  try {
    await Updates.reloadAsync();
  } catch {
    // Development builds reload through the dev menu's own route.
    DevSettings.reload();
  }
}
