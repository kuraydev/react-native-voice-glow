import { bell, clamp01, follow, shape, tailLift, wrapX } from './math';
import type { VoiceConfig, VoiceFrame } from './types';

/** Ceiling geometry the glow is masked to (px at scale 1), from upstream. */
export const CEILING_HALF_WIDTH = 170;
export const CEILING_HEIGHT = 64;
/** Samples along the band line. */
export const BAND_SAMPLES = 56;
/** Resting distance between lobes at scale 1. */
export const LOBE_SPACING = 120;

/** The lobe ring's span — how far a lobe travels before it wraps. */
export function lobeSpan(config: VoiceConfig): number {
  return Math.max(1, LOBE_SPACING * config.lobeSpacing * config.spread * config.scale);
}

export function emptyFrame(): VoiceFrame {
  return { level: 0, bands: [0, 0, 0], flowOffset: 0, hue: 0, morph: 0, sweep: 0 };
}

/**
 * The per-frame math: gate, follow, breathe, flow, sweep. Platform-free and
 * deterministic — advance it with a time step and it produces the frame the
 * renderer draws. Mutates `state` so a render loop allocates nothing.
 */
export function advance(
  state: VoiceFrame,
  clock: { elapsed: number; sweepPhase: number },
  dt: number,
  rawLevel: number,
  rawBands: readonly number[],
  config: VoiceConfig,
): VoiceFrame {
  if (config.paused) return state;

  const step = Math.min(Math.max(dt, 0), 0.05); // upstream clamps the step at 50 ms
  clock.elapsed += step;

  // Idle breathing keeps the glow alive between words; Reduce Motion holds it
  // at its resting level instead.
  const breathe = config.reducedMotion
    ? config.idle
    : config.idle *
      (0.5 + 0.5 * Math.sin((Math.PI * 2 * clock.elapsed) / Math.max(0.2, config.breatheDuration)));

  const targetLevel = config.processing
    ? Math.max(config.processingLevel, breathe)
    : Math.max(shape(rawLevel, config.threshold), breathe);
  state.level = follow(state.level, targetLevel, step, config.attack, config.release);

  for (let i = 0; i < 3; i++) {
    const raw = rawBands[i] ?? 0;
    const target = config.processing
      ? config.processingLevel * 0.6
      : shape(raw, config.threshold);
    state.bands[i] = follow(state.bands[i], target, step, config.attack, config.release);
  }

  // Lobes drift at a speed set by how loud it is, wrapped into the ring so a
  // lobe never pops from one side to the other.
  if (!config.reducedMotion && config.flow !== 0) {
    state.flowOffset = wrapX(
      state.flowOffset + config.flow * state.level * step,
      lobeSpan(config),
    );
  }

  state.hue =
    config.staticColors || config.reducedMotion
      ? 0
      : Math.max(0, config.hueRange) *
        Math.sin((Math.PI * 2 * clock.elapsed) / Math.max(0.5, config.hueDuration));

  // The morph runs on its own clock so the swap between glow and beam reads as
  // the shimmer coming to rest rather than a cut.
  const ease = Math.max(0.001, config.processingEase);
  state.morph = follow(state.morph, config.processing ? 1 : 0, step, ease, ease);

  if (config.processing && !config.reducedMotion) {
    clock.sweepPhase += step / Math.max(0.05, config.processingDuration);
    if (clock.sweepPhase >= 2) clock.sweepPhase -= 2;
    // Ping-pong with an eased turn: the beam dwells at each end rather than
    // snapping back.
    const forward = clock.sweepPhase < 1;
    const u = forward ? clock.sweepPhase : clock.sweepPhase - 1;
    const k = Math.max(1, config.processingCurve);
    const eased = u < 0.5 ? 0.5 * Math.pow(2 * u, k) : 1 - 0.5 * Math.pow(2 - 2 * u, k);
    state.sweep = forward ? 2 * eased - 1 : 1 - 2 * eased;
  } else {
    state.sweep = follow(state.sweep, 0, step, ease, ease);
  }

  return state;
}

/** The band line as sampled points, in the host's coordinate space. */
export function bandPoints(
  config: VoiceConfig,
  frame: VoiceFrame,
  width: number,
  baseline: number,
  centre: number,
): Array<[number, number]> {
  const level = clamp01(frame.level);
  const halfWidth = width / 2 + config.bandTailOverflow;
  const peak =
    CEILING_HEIGHT * config.bandWidth * config.bandPosition * config.scale * (0.3 + 0.7 * level);
  const offset = config.bandOffset * config.scale;

  const points: Array<[number, number]> = [];
  for (let i = 0; i <= BAND_SAMPLES; i++) {
    const x = -halfWidth + (i / BAND_SAMPLES) * halfWidth * 2;
    const normalised = x / Math.max(1, halfWidth);
    const b = bell(normalised, config.bandCurve, config.bandSpread, config.bandSkew);
    const t = tailLift(
      Math.abs(x),
      halfWidth,
      config.bandTail,
      config.bandTailPosition,
      config.bandTailCurve,
    );
    points.push([centre + x, baseline + offset - peak * (b + t)]);
  }
  return points;
}
