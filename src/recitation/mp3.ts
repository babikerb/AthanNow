const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SAMPLE_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Size and length of the MPEG Layer III frame starting at `i`, or null if there isn't one. */
function frameAt(b: Uint8Array, i: number): { bytes: number; seconds: number } | null {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3;
  const layer = (b[i + 1] >> 1) & 3;
  const bitrateIndex = b[i + 2] >> 4;
  const rateIndex = (b[i + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const samples = version === 3 ? 1152 : 576;
  const bitrate = (version === 3 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex];
  const padding = (b[i + 2] >> 1) & 1;
  return { bytes: Math.floor(((samples / 8) * bitrate * 1000) / sampleRate) + padding, seconds: samples / sampleRate };
}

/** True for the Xing/Info frame encoders put first: it holds metadata, not audio. */
function isInfoFrame(b: Uint8Array, start: number, bytes: number): boolean {
  for (let i = start + 4; i < start + Math.min(bytes, 48); i++) {
    const tag = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (tag === 'Xing' || tag === 'Info') return true;
  }
  return false;
}

/**
 * The audio inside an MP3: where its frames start and end, and how long they run. Everything else
 * is left out (the ID3 tags, the Info frame, trailing bytes), so clips can be joined end to end
 * into one stream, and the length comes from counting frames, which is exact.
 */
export function audioRange(b: Uint8Array): { start: number; end: number; seconds: number } | null {
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  // Past any padding to the first frame that is followed by another, so stray bytes can't pass as one.
  for (; i < b.length; i++) {
    const f = frameAt(b, i);
    if (f && frameAt(b, i + f.bytes)) break;
  }
  const first = frameAt(b, i);
  if (!first) return null;
  if (isInfoFrame(b, i, first.bytes)) i += first.bytes;

  const start = i;
  let seconds = 0;
  for (let f = frameAt(b, i); f && i + f.bytes <= b.length; f = frameAt(b, i)) {
    seconds += f.seconds;
    i += f.bytes;
  }
  return seconds > 0 ? { start, end: i, seconds } : null;
}
