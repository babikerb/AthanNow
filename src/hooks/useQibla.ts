import { Coordinates, Qibla } from 'adhan';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const MAKKAH_LAT = 21.4225;
const MAKKAH_LNG = 39.8262;
const EARTH_R_KM = 6371;

// Low-pass factor: lower = smoother but laggier. 0.18 reads steady without feeling sluggish.
const SMOOTHING = 0.18;

// --- Qibla "aligned" tolerance ---------------------------------------------
// The Qibla is the Kaaba itself, not a zero-dimensional point, so the set of
// headings that actually face it spans an angular width. For a target modelled
// as a spherical cap of angular radius ρ, seen from central angle θ, that
// half-width is Δ = asin(sin ρ / sin θ). It saturates at 90° as θ -> 0 (at/inside
// the Kaaba) and as θ -> π (its antipode), where every direction faces the Kaaba
// along the Earth's curvature, and is otherwise ~1e-4° — far below magnetometer
// precision. So the practical tolerance is max(sensor floor, Δ): the sensor floor
// rules everywhere normal, and Δ takes over near the two singular points.
const KAABA_RADIUS_M = 8; // effective half-size of the Kaaba structure (~12.5 x 11 m base)
const KAABA_RHO = KAABA_RADIUS_M / 1000 / EARTH_R_KM; // its angular radius (radians)
const SENSOR_TOL_DEG = 5; // compass/magnetometer practical accuracy

/** Great-circle central angle (radians) from a point to the Kaaba. */
function centralAngleRad(lat: number, lng: number): number {
  const dLat = (MAKKAH_LAT - lat) * (Math.PI / 180);
  const dLng = (MAKKAH_LNG - lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat * (Math.PI / 180)) * Math.cos(MAKKAH_LAT * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Angular half-width of headings that face the Kaaba, floored by sensor accuracy. */
function qiblaToleranceDeg(theta: number): number {
  const sinT = Math.sin(theta);
  // At/inside the Kaaba (θ→0) or its antipode (θ→π) every great circle reaches it,
  // so the half-width is the whole circle — any direction is valid.
  if (sinT <= Math.sin(KAABA_RHO)) return 180;
  const geom = (Math.asin(Math.min(1, Math.sin(KAABA_RHO) / sinT)) * 180) / Math.PI; // 0..90
  return Math.max(SENSOR_TOL_DEG, geom);
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
  /** Angular half-width (degrees) currently counted as "facing the Qibla". */
  toleranceDeg: number;
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
  // Low-pass filtered heading (degrees, 0..360) to kill sensor jitter.
  const smoothed = useRef<number | null>(null);

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
      const raw = usingTrue ? data.trueHeading : data.magHeading;

      // Exponential low-pass smoothing along the shortest arc (handles 360->0 wrap).
      if (smoothed.current === null) {
        smoothed.current = raw;
      } else {
        const delta = (((raw - smoothed.current) % 360) + 540) % 360 - 180; // (-180,180]
        // Ignore sub-degree noise; otherwise ease toward the new reading.
        if (Math.abs(delta) > 0.3) smoothed.current = (smoothed.current + SMOOTHING * delta + 360) % 360;
      }
      const h = smoothed.current;

      // Accumulate along the shortest path so the dial never spins the long way.
      const diff = (((-h - (lastAnimAngle.current % 360)) % 360) + 540) % 360 - 180;
      lastAnimAngle.current += diff;
      // A short glide (not an instant jump) further smooths the motion.
      Animated.timing(headingAnim, { toValue: lastAnimAngle.current, duration: 90, useNativeDriver: true }).start();

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
    const theta = centralAngleRad(latitude, longitude);
    return { bearing: Qibla(coords), distanceKm: Math.round(EARTH_R_KM * theta), tolerance: qiblaToleranceDeg(theta) };
  }, [latitude, longitude]);

  if (!qiblaInfo) {
    return { headingAnim, heading, qiblaBearing: 0, distanceKm: 0, cardinal: toCardinal(heading), isAligned: false, toleranceDeg: SENSOR_TOL_DEG, hasLocation: false, usingTrueHeading, headingAccuracy };
  }

  const { bearing: qiblaBearing, distanceKm, tolerance } = qiblaInfo;
  const needleRotation = (((qiblaBearing - heading) % 360) + 360) % 360;
  const diff = needleRotation > 180 ? 360 - needleRotation : needleRotation;

  return { headingAnim, heading, qiblaBearing, distanceKm, cardinal: toCardinal(heading), isAligned: diff < tolerance, toleranceDeg: tolerance, hasLocation: true, usingTrueHeading, headingAccuracy };
}
