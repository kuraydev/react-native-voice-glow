import { advance, emptyFrame, lobeSpan } from '../driver';
import { resolveConfig } from '../presets';
import type { VoiceConfig } from '../types';

const config = (over: Partial<VoiceConfig> = {}): VoiceConfig =>
  // silence means silence, so gate behaviour is readable
  resolveConfig('default', 'dark', { idle: 0, staticColors: true, ...over });

const run = (
  c: VoiceConfig,
  frames: number,
  level: number,
  bands: [number, number, number] = [0, 0, 0],
  state = emptyFrame(),
  clock = { elapsed: 0, sweepPhase: 0 },
) => {
  for (let i = 0; i < frames; i++) advance(state, clock, 1 / 60, level, bands, c);
  return { state, clock };
};

describe('voice driver', () => {
  it('stays dark in silence', () => {
    const { state } = run(config(), 120, 0);
    expect(state.level).toBeCloseTo(0, 9);
  });

  it('gates input below the threshold', () => {
    const { state } = run(config({ threshold: 0.2 }), 120, 0.19);
    expect(state.level).toBeCloseTo(0, 9);
  });

  it('rises on a loud input and decays after it', () => {
    const c = config();
    const { state, clock } = run(c, 120, 1, [1, 1, 1]);
    const peak = state.level;
    expect(peak).toBeGreaterThan(0.8);

    run(c, 300, 0, [0, 0, 0], state, clock);
    expect(state.level).toBeLessThan(peak * 0.05);
  });

  it('keeps the level in range under erratic input', () => {
    const c = config({ idle: 0.23 });
    const state = emptyFrame();
    const clock = { elapsed: 0, sweepPhase: 0 };
    for (let i = 0; i < 600; i++) {
      advance(state, clock, 1 / 60, (i % 7) * 0.9, [2, 0.4, 3], c);
      expect(state.level).toBeGreaterThanOrEqual(0);
      expect(state.level).toBeLessThanOrEqual(1.0001);
    }
  });

  it('breathes while idle', () => {
    const c = config({ idle: 0.3, breatheDuration: 2 });
    const state = emptyFrame();
    const clock = { elapsed: 0, sweepPhase: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      advance(state, clock, 1 / 60, 0, [0, 0, 0], c);
      seen.push(state.level);
    }
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.01);
    expect(Math.max(...seen)).toBeLessThanOrEqual(0.31);
  });

  it('stops flow and breathing under reduced motion', () => {
    const c = config({ idle: 0.3, reducedMotion: true, flow: 100 });
    const state = emptyFrame();
    const clock = { elapsed: 0, sweepPhase: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 240; i++) {
      advance(state, clock, 1 / 60, 0, [0, 0, 0], c);
      seen.push(state.level);
    }
    expect(state.flowOffset).toBeCloseTo(0, 9);
    const tail = seen.slice(-30);
    expect(Math.max(...tail) - Math.min(...tail)).toBeLessThan(1e-3);
  });

  it('holds the frame while paused', () => {
    const c = config();
    const { state, clock } = run(c, 60, 1, [1, 1, 1]);
    const held = { ...state, bands: [...state.bands] };
    run({ ...c, paused: true }, 60, 0, [0, 0, 0], state, clock);
    expect(state).toEqual(held);
  });

  it('keeps the processing sweep on the edge and morphs in', () => {
    const c = config({ processing: true });
    const state = emptyFrame();
    const clock = { elapsed: 0, sweepPhase: 0 };
    for (let i = 0; i < 600; i++) {
      advance(state, clock, 1 / 60, 0, [0, 0, 0], c);
      expect(state.sweep).toBeGreaterThanOrEqual(-1.0001);
      expect(state.sweep).toBeLessThanOrEqual(1.0001);
    }
    expect(state.morph).toBeGreaterThan(0.9);
  });

  it('clamps a long frame gap so a backgrounded app does not jump', () => {
    const c = config();
    const a = emptyFrame();
    const b = emptyFrame();
    advance(a, { elapsed: 0, sweepPhase: 0 }, 5, 1, [1, 1, 1], c);
    advance(b, { elapsed: 0, sweepPhase: 0 }, 0.05, 1, [1, 1, 1], c);
    expect(a.level).toBeCloseTo(b.level, 9);
  });

  it('wraps lobe drift into the ring', () => {
    const c = config({ flow: 400 });
    const span = lobeSpan(c);
    const { state } = run(c, 600, 1, [1, 1, 1]);
    expect(Math.abs(state.flowOffset)).toBeLessThanOrEqual(span / 2 + 1e-9);
  });
});
