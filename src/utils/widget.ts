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

/**
 * The prayer times themselves already reflect the user's calculation method and
 * madhab (the app computes them with those settings before calling here). We also
 * pass `use24Hour` so the widget renders clock times in the user's chosen format.
 */
export async function updateWidgetData(
  city: string,
  times: WidgetPrayer[],
  use24Hour: boolean,
): Promise<void> {
  try {
    await SharedGroupPreferences.setItem(KEY, JSON.stringify({ city, times, use24Hour }), APP_GROUP);
  } catch {
    // Native module/widget not in this build yet, or App Group unavailable.
  }
}
