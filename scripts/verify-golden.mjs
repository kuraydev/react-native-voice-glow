// Asserts this port reproduces upstream voice-glow's math exactly.
//
// The vectors in spec/voice-golden.json are not hand-written: they are produced
// by lifting the pure functions out of upstream's voiceDriver.ts and evaluating
// them. A mistyped constant fails here instead of shipping as a subtly wrong
// animation.
//
// Run: npm run verify:golden
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(resolve(here, '../spec/voice-golden.json'), 'utf8'));

// The math module is plain TypeScript with no RN imports; strip the types so it
// runs under bare node without a build step.
const source = readFileSync(resolve(here, '../src/math.ts'), 'utf8')
  .replace(/\)\s*:\s*\[[^\]]*\]\s*\{/g, ') {')          // tuple return types
  .replace(/:\s*ReadonlyArray<[^>]*>/g, '')
  .replace(/\bas\s+\[[^\]]*\]/g, '')
  .replace(/:\s*(number|string|boolean|Float32Array|Uint8Array)(\[\])?/g, '')
  .replace(/^export /gm, '');

const api = new Function(`${source}\nreturn { clamp01, wrapX, edgeEnvelope, shape, follow, bell, tailLift, pingPong, BASE_GAIN, BAND_GAIN, BANDS, FFT_SIZE, SMOOTHING_TIME_CONSTANT, levelFrom, bandsFrom };`)();

const tol = golden.tolerance;
let checked = 0;
const failures = [];

const expect = (label, actual, wanted) => {
  checked++;
  if (!Number.isFinite(actual) || Math.abs(actual - wanted) > tol) {
    failures.push(`${label}: got ${actual}, want ${wanted}`);
  }
};

const V = golden.vectors;
for (const [threshold, raw, out] of V.shape) expect(`shape(${raw}, ${threshold})`, api.shape(raw, threshold), out);
for (const [attack, release, dt, prev, target, out] of V.follow)
  expect(`follow(${prev}→${target})`, api.follow(prev, target, dt, attack, release), out);
for (const [p, sigma, skew, t, out] of V.bell) expect(`bell(${t})`, api.bell(t, p, sigma, skew), out);
for (const [lift, position, curve, edge, dist, out] of V.tailLift)
  expect(`tailLift(${dist}/${edge})`, api.tailLift(dist, edge, lift, position, curve), out);
for (const [span, x, out] of V.edgeEnvelope) expect(`edgeEnvelope(${x}, ${span})`, api.edgeEnvelope(x, span), out);
for (const [span, x, out] of V.wrapX) expect(`wrapX(${x}, ${span})`, api.wrapX(x, span), out);
for (const [phase, out] of V.pingPong) expect(`pingPong(${phase})`, api.pingPong(phase), out);

// Constants: a drift here rescales every level the component produces.
const C = golden.constants;
expect('BASE_GAIN', api.BASE_GAIN, C.BASE_GAIN);
expect('BAND_GAIN', api.BAND_GAIN, C.BAND_GAIN);
expect('FFT_SIZE', api.FFT_SIZE, C.fftSize);
expect('SMOOTHING_TIME_CONSTANT', api.SMOOTHING_TIME_CONSTANT, C.smoothingTimeConstant);
C.BANDS.forEach(([lo, hi], i) => {
  expect(`BANDS[${i}].low`, api.BANDS[i][0], lo);
  expect(`BANDS[${i}].high`, api.BANDS[i][1], hi);
});

// Analyser: same synthetic buffers the extractor used.
const time = new Float32Array(C.fftSize);
for (let i = 0; i < time.length; i++) {
  time[i] = 0.35 * Math.sin((2 * Math.PI * 220 * i) / C.sampleRate)
          + 0.18 * Math.sin((2 * Math.PI * 1800 * i) / C.sampleRate)
          + 0.05 * Math.sin(i * 12.9898);
}
const freq = new Uint8Array(C.fftSize / 2);
for (let i = 0; i < freq.length; i++) freq[i] = (i * 37 + 11) % 256;

for (const c of golden.analyser.cases) {
  expect(`level@${c.sensitivity}`, api.levelFrom(time, c.sensitivity), c.level);
  const bands = api.bandsFrom(freq, C.sampleRate, C.fftSize, c.sensitivity);
  c.bands.forEach((want, i) => expect(`band${i}@${c.sensitivity}`, bands[i], want));
}

if (failures.length) {
  console.error(`✗ ${failures.length} of ${checked} golden checks failed:\n  ` + failures.slice(0, 20).join('\n  '));
  process.exit(1);
}
console.log(`✓ ${checked} golden checks passed against voice-glow ${golden.sourceLibrary.version}`);
