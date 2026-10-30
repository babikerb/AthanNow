import { Coordinates, Qibla } from 'adhan';
import * as Location from 'expo-location';
import * as geomagnetism from 'geomagnetism';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const MAKKAH_LAT = 21.4225;
const MAKKAH_LNG = 39.8262;
const EARTH_R_KM = 6371;

// The dial follows the sensor with a time-based ease (time constant in ms): smooth at display rate
// whatever the sensor's own rate, without feeling sluggish.
const FOLLOW_MS = 75;
// Readings closer than this to the current target are sensor noise.
const NOISE_DEG = 0.4;
// Each time the compass starts, iOS first hands back its last cached heading, and the sensor takes a
// moment to settle after that. The dial waits for this many readings, at least this long, that agree
// within SETTLE_SPREAD_DEG, before it points anywhere.
const SETTLE_READINGS = 5;
const SETTLE_MIN_MS = 600;
const SETTLE_SPREAD_DEG = 6;

// --- Qibla "aligned" tolerance ---------------------------------------------
// The Qibla is the Kaaba itself, not a zero-dimensional point, so the set of
// headings that actually face it spans an angular width. For a target modelled
// as a spherical cap of angular radius ρ, seen from central angle θ, that
// half-width is Δ = asin(sin ρ / sin θ). It saturates at 90° as θ -> 0 (at/inside
// the Kaaba) and as θ -> π (its antipode), where every direction faces the Kaaba
// along the Earth's curvature, and is otherwise ~1e-4°, far below magnetometer
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
  // so the half-width is the whole circle, any direction is valid.
  if (sinT <= Math.sin(KAABA_RHO)) return 180;
  const geom = (Math.asin(Math.min(1, Math.sin(KAABA_RHO) / sinT)) * 180) / Math.PI; // 0..90
  return Math.max(SENSOR_TOL_DEG, geom);
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function toCardinal(deg: number): string {
  return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
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
  /** expo-location accuracy level: 3 = within 20 degrees, 2 = 20-35, 1 = 35-50, 0 = worse or unknown; -1 before any reading. */
  headingAccuracy: number;
  /** null while detecting, true if the device reports a compass heading, false
   *  when no heading ever arrives (e.g. a Wi-Fi iPad with no magnetometer). */
  compassAvailable: boolean | null;
  /** False from each start of the compass until its readings have settled; the dial waits for it. */
  settled: boolean;
}

/**
 * Native iOS compass via expo-location heading + adhan Qibla bearing.
 *
 * Runs only while `active` (the Qibla tab is on screen): the sensor, the GPS watch and the per-frame
 * follower all stop otherwise, so the compass costs nothing on other tabs. The dial's rotation is an
 * Animated.Value driven once per display frame toward the latest reading, so it glides instead of
 * restarting an animation per sensor event; React state only changes when the shown degree or the
 * calibration state actually changes.
 */
export function useQibla(latitude: number | null, longitude: number | null, active = true, useLiveFix = false): QiblaData {
  const [heading, setHeading] = useState(0);
  const [settled, setSettled] = useState(false);
  // A fresh GPS fix taken each time the compass starts, so the bearing is for where the phone is
  // now rather than wherever the app last saved (which can be a city away after travelling).
  const [fix, setFix] = useState<{ latitude: number; longitude: number } | null>(null);
  const lat = useLiveFix && fix ? fix.latitude : latitude;
  const lng = useLiveFix && fix ? fix.longitude : longitude;
  const [usingTrueHeading, setUsingTrueHeading] = useState(false);
  const [headingAccuracy, setHeadingAccuracy] = useState(-1);
  const [compassAvailable, setCompassAvailable] = useState<boolean | null>(null);

  const headingAnim = useRef(new Animated.Value(0)).current;
  // Unwrapped angles (degrees, can run past 360) so the dial always turns the short way.
  const target = useRef<number | null>(null);
  const shown = useRef(0);
  const frame = useRef<number | null>(null);
  const lastFrameAt = useRef(0);
  const lastStateDeg = useRef<number | null>(null);
  const accuracyLevel = useRef<number | null>(null);
  // Magnetic declination here today (World Magnetic Model 2025), east positive. iOS only reports true
  // north when its heading manager also has a location fix, which expo-location's doesn't, so true
  // heading = magnetic heading + declination.
  const declination = useRef(0);
  useEffect(() => {
    if (lat == null || lng == null) return;
    try {
      declination.current = geomagnetism.model(new Date(), { allowOutOfBoundsModel: true }).point([lat, lng]).decl;
    } catch {
      declination.current = 0;
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!active) return;
    let headingSub: Location.LocationSubscription | null = null;
    let gpsSub: Location.LocationSubscription | null = null;
    let cancelled = false;
    let sawHeading = false;
    // Start from nothing every time: no heading, accuracy or settling carried over from last time.
    const startedAt = Date.now();
    const recent: number[] = [];
    let isSettled = false;
    target.current = null;
    lastStateDeg.current = null;
    accuracyLevel.current = null;
    setHeadingAccuracy(-1);
    setSettled(false);

    // Eases `shown` toward `target` each frame; stops itself once settled.
    const step = (now: number) => {
      frame.current = null;
      if (cancelled || target.current == null) return;
      const dt = lastFrameAt.current ? Math.min(64, now - lastFrameAt.current) : 16;
      lastFrameAt.current = now;
      const delta = target.current - shown.current;
      shown.current += delta * (1 - Math.exp(-dt / FOLLOW_MS));
      if (Math.abs(delta) < 0.02) shown.current = target.current;
      headingAnim.setValue(-shown.current);
      if (shown.current !== target.current) frame.current = requestAnimationFrame(step);
      else lastFrameAt.current = 0;
    };
    const kick = () => {
      if (frame.current == null) frame.current = requestAnimationFrame(step);
    };

    // If no heading arrives shortly after subscribing, the device has no usable compass (Wi-Fi
    // iPads). Distinct from "needs calibration", where events arrive with accuracy < 0.
    const noCompassTimer = setTimeout(() => {
      if (!cancelled && !sawHeading) setCompassAvailable(false);
    }, 4000);

    // A fresh fix for the bearing and the declination (see `fix` above).
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 200 }, (p) => {
      if (!cancelled) setFix({ latitude: p.coords.latitude, longitude: p.coords.longitude });
    })
      .then((sub) => {
        if (!cancelled) gpsSub = sub;
        else sub.remove();
      })
      .catch(() => {});

    Location.watchHeadingAsync((data) => {
      if (cancelled) return;
      if (!sawHeading) {
        sawHeading = true;
        setCompassAvailable(true);
      }
      if (accuracyLevel.current !== data.accuracy) {
        accuracyLevel.current = data.accuracy;
        setHeadingAccuracy(data.accuracy);
      }

      // Always magnetic heading + the model's declination. iOS's own true heading only appears once
      // in a while here (it needs a fix on its own heading manager), and switching between the two
      // mid-session made the dial jump by the error between them.
      const usingTrue = true;
      const raw = (((data.magHeading + declination.current) % 360) + 360) % 360;

      if (!isSettled) {
        recent.push(raw);
        if (recent.length > SETTLE_READINGS) recent.shift();
        const spread = recent.length < SETTLE_READINGS ? 360 : Math.max(...recent.map((h) => Math.abs(((((h - raw) % 360) + 540) % 360) - 180)));
        if (Date.now() - startedAt < SETTLE_MIN_MS || spread > SETTLE_SPREAD_DEG || data.accuracy < 2) return;
        isSettled = true;
        setSettled(true);
        target.current = null;
      }

      // Unwrap onto the current target so 359 -> 1 is a 2 degree step, not a full turn.
      if (target.current == null) {
        target.current = raw;
        shown.current = raw;
        headingAnim.setValue(-raw);
      } else {
        const d = ((((raw - target.current) % 360) + 540) % 360) - 180;
        if (Math.abs(d) < NOISE_DEG) return;
        target.current += d;
      }
      kick();

      const deg = (((Math.round(target.current) % 360) + 360) % 360);
      if (deg !== lastStateDeg.current) {
        lastStateDeg.current = deg;
        setHeading(deg);
        setUsingTrueHeading(usingTrue);
      }
    })
      .then((sub) => {
        if (!cancelled) headingSub = sub;
        else sub.remove();
      })
      .catch(() => {
        if (!cancelled) setCompassAvailable(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(noCompassTimer);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
      lastFrameAt.current = 0;
      headingSub?.remove();
      gpsSub?.remove();
    };
  }, [active, headingAnim]);

  const qiblaInfo = useMemo(() => {
    if (lat == null || lng == null) return null;
    const coords = new Coordinates(lat, lng);
    const theta = centralAngleRad(lat, lng);
    return { bearing: Qibla(coords), distanceKm: Math.round(EARTH_R_KM * theta), tolerance: qiblaToleranceDeg(theta) };
  }, [lat, lng]);

  if (!qiblaInfo) {
    return { headingAnim, heading, qiblaBearing: 0, distanceKm: 0, cardinal: toCardinal(heading), isAligned: false, toleranceDeg: SENSOR_TOL_DEG, hasLocation: false, usingTrueHeading, headingAccuracy, compassAvailable, settled };
  }

  const { bearing: qiblaBearing, distanceKm, tolerance } = qiblaInfo;
  const needleRotation = (((qiblaBearing - heading) % 360) + 360) % 360;
  const diff = needleRotation > 180 ? 360 - needleRotation : needleRotation;

  return { headingAnim, heading, qiblaBearing, distanceKm, cardinal: toCardinal(heading), isAligned: diff < tolerance, toleranceDeg: tolerance, hasLocation: true, usingTrueHeading, headingAccuracy, compassAvailable, settled };
}
