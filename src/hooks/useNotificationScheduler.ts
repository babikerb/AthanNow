import { useEffect, useRef } from 'react';

import { Settings, SettingsContextValue } from '../context/SettingsContext';
import { AppLocation } from './useLocation';
import {
  cancelAllNotifications,
  requestNotificationPermission,
  rescheduleNotifications,
} from '../utils/notifications';

function anyNotificationEnabled(s: Settings): boolean {
  const n = s.notifications;
  return Object.values(n.athanEnabled).some(Boolean) || n.quranMorningEnabled;
}

/**
 * Re-schedules local notifications whenever the location or notification-relevant
 * settings change. Requests permission lazily the first time something is enabled.
 */
export function useNotificationScheduler(location: AppLocation | null, settings: SettingsContextValue) {
  // Serialize the inputs that actually affect the schedule so we only reschedule on real changes.
  const signature = JSON.stringify({
    lat: location?.latitude,
    lng: location?.longitude,
    method: settings.calcMethod,
    madhab: settings.asrMadhab,
    notifications: settings.notifications,
    ready: settings.ready,
  });
  const lastSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!settings.ready || !location) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    (async () => {
      if (!anyNotificationEnabled(settings)) {
        await cancelAllNotifications();
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await rescheduleNotifications(location, settings);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
