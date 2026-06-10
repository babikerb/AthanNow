import SharedGroupPreferences from 'react-native-shared-group-preferences';

/**
 * Writes the day's prayer times to the App Group so the iOS home-screen widget
 * can render them. No-ops gracefully until a build that includes the native
 * shared-group module + widget extension (it cannot ship via OTA).
 */

const APP_GROUP = 'group.com.bbabiker.AthanNow';
const KEY = 'athannow_widget';

export interface WidgetPrayer {
  name: string;
  time: number; // epoch seconds
}

export async function updateWidgetData(city: string, times: WidgetPrayer[]): Promise<void> {
  try {
    await SharedGroupPreferences.setItem(KEY, JSON.stringify({ city, times }), APP_GROUP);
  } catch {
    // Native module/widget not in this build yet, or App Group unavailable.
  }
}
