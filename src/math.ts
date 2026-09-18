/**
 * The driver math, ported from voice-glow's `voiceDriver.ts` (MIT, Jakub
 * Antalik). Every function here is covered by golden vectors lifted from that
 * source — run `npm run verify:golden`. Keep the two in step: change a constant
 * here and the check fails rather than the animation quietly drifting.
 */

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Wrap a lobe offset into [-span/2, span/2). */
export function wrapX(x: number, span: number): number {
  const half = span / 2;
  return ((((x + half) % span) + span) % span) - half;
}

/**
 * How much of a lobe shows at offset x: full at centre, gone at the wrap edge
 * so a lobe never pops from one side to the other.
 */
export function edgeEnvelope(x: number, span: number): number {
  const t = x / (span / 2 + 4);
  return Math.max(0, 1 - t * t);
}

/** Noise gate then soft saturation, so a shout rounds off instead of clipping. */
export function shape(raw: number, threshold: number): number {
  if (raw <= threshold) return 0;
  const t = (raw - threshold) / Math.max(0.001, 1 - threshold);
  return clamp01((1 - Math.exp(-3 * t)) / (1 - Math.exp(-3)));
}

/** One-pole follower: fast up (attack), slow down (release). */
export function follow(
  prev: number,
  target: number,
  dt: number,
  attack: number,
  release: number,
): number {
  const tau = target > prev ? attack : release;
  const a = 1 - Math.exp(-dt / Math.max(0.001, tau));
  return prev + (target - prev) * a;
}

/**
 * The band's bell, normalised to 1 at the centre and exactly 0 at the ends.
 * `p` below 2 gives a cusp-like rise, above 2 a flatter top; `skew` widens one
 * side and narrows the other.
 */
export function bell(t: number, p: number, sigma: number, skew: number): number {
  const side = t < 0 ? 1 - skew : 1 + skew;
  const s = Math.max(0.05, sigma * side);
  const v = Math.exp(-Math.pow(Math.abs(t) / s, p));
  const tail = Math.exp(-Math.pow(1 / s, p));
  return Math.max(0, (v - tail) / (1 - tail));
}

/**
 * The band's tail lift: from `position` of the way out to the edge, the line
 * rises again to the full `lift` exactly at the corner.
 */
export function tailLift(
  dist: number,
  edge: number,
  lift: number,
  position: number,
  curve: number,
): number {
  if (lift <= 0 || edge <= 0) return 0;
  const start = edge * Math.max(0, Math.min(0.98, position));
  if (dist <= start) return 0;
  const u = Math.min(1, (dist - start) / Math.max(1, edge - start));
  return lift * Math.pow(u, Math.max(0.5, curve));
}

/** 0 → 1 → 0 over one unit of phase. */
export function pingPong(phase: number): number {
  return (1 - Math.cos(Math.PI * 2 * phase)) / 2;
}

// ── analyser constants, matched to upstream's Web Audio setup ───────────────

/** Voice bands in Hz: fundamentals and chest, vowels and presence, sibilance. */
export const BANDS: ReadonlyArray<readonly [number, number]> = [
  [80, 300],
  [300, 2000],
  [2000, 6000],
];

export const BASE_GAIN = 5;
export const BAND_GAIN = 1.7;
/** 1024 bins at 48 kHz is ~47 Hz per bin: enough to split the voice bands. */
export const FFT_SIZE = 1024;
/** The driver does its own attack/release, so spectrum smoothing stays light. */
export const SMOOTHING_TIME_CONSTANT = 0.5;

/** RMS of the time-domain window, gained the way upstream gains it. */
export function levelFrom(timeDomain: Float32Array, sensitivity: number): number {
  if (timeDomain.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) sum += timeDomain[i] * timeDomain[i];
  return Math.sqrt(sum / timeDomain.length) * BASE_GAIN * sensitivity;
}

/** Average each voice band out of a 0–255 spectrum. */
export function bandsFrom(
  freq: Uint8Array,
  sampleRate: number,
  fftSize: number,
  sensitivity: number,
): [number, number, number] {
  const binHz = sampleRate / fftSize;
  const out: number[] = [];
  for (const [lo, hi] of BANDS) {
    const from = Math.max(0, Math.floor(lo / binHz));
    const to = Math.min(freq.length - 1, Math.ceil(hi / binHz));
    let acc = 0;
    for (let i = from; i <= to; i++) acc += freq[i];
    const avg = to >= from ? acc / (to - from + 1) / 255 : 0;
    out.push(avg * BAND_GAIN * sensitivity);
  }
  return out as [number, number, number];
}
