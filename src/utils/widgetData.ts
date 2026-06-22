import { getPrayerTimes } from './prayerEngine';
import { localDayAnchor } from './time';
import { updateWidgetData } from './widget';

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS = 7;

interface Coords {
  latitude: number;
  longitude: number;
  timezone?: string;
}

/**
 * Builds and writes a full week of prayer times to the iOS widget App Group.
 * A week (not just today) guarantees the widget always has a real future prayer
 * to count down to even if the app isn't opened for several days. Shared by the
 * Athan screen and the background-refresh task so both write an identical shape.
 */
export async function refreshWidgetData(
  location: Coords,
  cityName: string,
  calcMethod: string,
  asrMadhab: string,
  use24Hour: boolean,
  now: Date = new Date(),
): Promise<void> {
  const tz = location.timezone;
  const toRows = (rows: { label: string; time: Date }[]) =>
    rows.map((r) => ({ name: r.label, time: Math.floor(r.time.getTime() / 1000) }));

  const week: { name: string; time: number }[][] = [];
  for (let d = 0; d < DAYS; d += 1) {
    const anchor = localDayAnchor(new Date(now.getTime() + d * DAY_MS), tz);
    week.push(toRows(getPrayerTimes(location, anchor, calcMethod, asrMadhab).listRows));
  }
  await updateWidgetData(cityName, week.flat(), use24Hour);
}
