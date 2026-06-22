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
  // Serialize reschedules. Each run does cancelAll() then schedules ~60 awaited
  // notifications; on launch the signature changes more than once (restored city ->
  // GPS city), so without this a later run's cancelAll() could fire mid-way through
  // an earlier run's scheduling loop and wipe notifications it had already booked —
  // which is why some athans "sometimes" didn't fire. Chaining keeps runs strictly
  // sequential, so the last (newest) signature always leaves the final state.
  const chain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!settings.ready || !location) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;

    chain.current = chain.current
      .then(async () => {
        if (!anyNotificationEnabled(settings)) {
          await cancelAllNotifications();
          return;
        }
        const granted = await requestNotificationPermission();
        if (!granted) return;
        await rescheduleNotifications(location, settings);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
