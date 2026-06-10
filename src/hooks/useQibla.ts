import { Coordinates, Qibla } from 'adhan';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const MAKKAH_LAT = 21.4225;
const MAKKAH_LNG = 39.8262;

function haversineKm(lat: number, lng: number): number {
  const R = 6371;
  const dLat = (MAKKAH_LAT - lat) * (Math.PI / 180);
  const dLng = (MAKKAH_LNG - lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * (Math.PI / 180)) * Math.cos(MAKKAH_LAT * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function toCardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface QiblaData {
  headingAnim: Animated.Value;
  heading: number;
  qiblaBearing: number;
  distanceKm: number;
  cardinal: string;
  isAligned: boolean;
  hasLocation: boolean;
  usingTrueHeading: boolean;
  headingAccuracy: number;
}

/** Native iOS compass via expo-location heading + adhan Qibla bearing. */
export function useQibla(latitude: number | null, longitude: number | null): QiblaData {
  const [heading, setHeading] = useState(0);
  const [usingTrueHeading, setUsingTrueHeading] = useState(false);
  const [headingAccuracy, setHeadingAccuracy] = useState(-1);

  const headingAnim = useRef(new Animated.Value(0)).current;
  const lastAnimAngle = useRef(0);
  const lastHeadingRef = useRef(0);

  useEffect(() => {
    let headingSub: Location.LocationSubscription | null = null;
    let gpsSub: Location.LocationSubscription | null = null;
    let cancelled = false;

    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 500 }, () => {}).then((s) => {
      if (!cancelled) gpsSub = s;
      else s.remove();
    });

    Location.watchHeadingAsync((data) => {
      if (cancelled) return;
      setHeadingAccuracy(data.accuracy);
      if (data.accuracy < 0) return;

      const usingTrue = data.trueHeading >= 0;
      const h = usingTrue ? data.trueHeading : data.magHeading;

      const animTarget = -h;
      const diff = (((animTarget - (lastAnimAngle.current % 360)) % 360) + 540) % 360 - 180;
      lastAnimAngle.current += diff;
      Animated.timing(headingAnim, { toValue: lastAnimAngle.current, duration: 16, useNativeDriver: true }).start();

      if (angularDiff(h, lastHeadingRef.current) >= 1) {
        lastHeadingRef.current = h;
        setHeading(h);
        setUsingTrueHeading(usingTrue);
      }
    }).then((s) => {
      if (!cancelled) headingSub = s;
      else s.remove();
    });

    return () => {
      cancelled = true;
      headingSub?.remove();
      gpsSub?.remove();
    };
  }, [headingAnim]);

  const qiblaInfo = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    const coords = new Coordinates(latitude, longitude);
    return { bearing: Qibla(coords), distanceKm: haversineKm(latitude, longitude) };
  }, [latitude, longitude]);

  if (!qiblaInfo) {
    return { headingAnim, heading, qiblaBearing: 0, distanceKm: 0, cardinal: toCardinal(heading), isAligned: false, hasLocation: false, usingTrueHeading, headingAccuracy };
  }

  const { bearing: qiblaBearing, distanceKm } = qiblaInfo;
  const needleRotation = (((qiblaBearing - heading) % 360) + 360) % 360;
  const diff = needleRotation > 180 ? 360 - needleRotation : needleRotation;

  return { headingAnim, heading, qiblaBearing, distanceKm, cardinal: toCardinal(heading), isAligned: diff < 5, hasLocation: true, usingTrueHeading, headingAccuracy };
}
