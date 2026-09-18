/** Preset shapes, matching upstream voice-glow's `type` prop. */
export type VoiceBeamType = 'default' | 'pill' | 'mobile';

export type VoiceBeamTheme = 'dark' | 'light';

/** The band's core and its fringes, as `[r, g, b]` triples. */
export interface VoiceBandColors {
  core: string;
  above: string;
  mid: string;
  below: string;
}

/** Everything the beam responds to. Defaults track voice-glow 0.2.0. */
export interface VoiceConfig {
  /** Input gain applied to the microphone level. @default 3.1 */
  sensitivity: number;
  /** Noise gate: levels at or below this read as silence. @default 0.015 */
  threshold: number;
  /** Seconds for the glow to rise to a new louder level. @default 0.325 */
  attack: number;
  /** Seconds for it to fall back. @default 0.86 */
  release: number;
  /** How lit the glow sits when nobody is speaking, 0–1. @default 0.23 */
  idle: number;
  /** Seconds for one breath of the idle glow. @default 5.2 */
  breatheDuration: number;

  /** Overall size of the effect. @default 1 */
  scale: number;
  /** How far the glow reaches up from the edge. @default 1.2 */
  reach: number;
  /** How wide the lobes sit apart. @default 1.05 */
  spread: number;
  /** Lobe drift in px/s at full level; negative flows right-to-left. @default 48 */
  flow: number;
  /** Extra px of height the glow's top gains at the centre at full level. @default 60 */
  bend: number;
  /** Bloom blur multiplier. @default 1 */
  glowSize: number;
  /** Resting distance between lobes. @default 0.85 */
  lobeSpacing: number;

  bandStrength: number;
  bandWidth: number;
  bandPosition: number;
  /** Bell exponent: below 2 a cusp-like rise, 2 a gaussian, above a flatter top. */
  bandCurve: number;
  /** Bell width: small is a narrow spike with long tails, large a broad dome. */
  bandSpread: number;
  /** Positive widens the right side and steepens the left. */
  bandSkew: number;
  /** Vertical shift of the whole line, px (negative lowers it). */
  bandOffset: number;
  /** Rise of the ends toward the corners, as a fraction of the peak. */
  bandTail: number;
  bandTailPosition: number;
  bandTailCurve: number;
  /** Px the band runs past each side before the host crops it. */
  bandTailOverflow: number;
  /** Chromatic split across the band's fringes. */
  bandAberration: number;

  /** While true the glow gathers into a travelling beam. */
  processing: boolean;
  processingDuration: number;
  processingLevel: number;
  processingTravel: number;
  processingCurve: number;
  processingEase: number;
  cornerFollow: number;

  theme: VoiceBeamTheme;
  /** Degrees of hue drift across one cycle. */
  hueRange: number;
  hueDuration: number;
  staticColors: boolean;
  /** Beam colours, bottom to top of the bloom. */
  colors: string[];
  bandColors: VoiceBandColors;

  /** Corner radius of the host, px. */
  radius: number;
  /** Hold the frame: the clock stops and the source is not read. */
  paused: boolean;
  /** Honour Reduce Motion: no flow, no breathing, no sweep. */
  reducedMotion: boolean;
}

/** One frame of resolved animation state. */
export interface VoiceFrame {
  /** Shaped, followed level, 0–1. The glow's height rides this. */
  level: number;
  /** The three voice bands, shaped and followed. */
  bands: [number, number, number];
  /** Lobe drift in px, wrapped into the lobe ring. */
  flowOffset: number;
  /** Hue drift in degrees. */
  hue: number;
  /** How far into the processing morph, 0 (glow) → 1 (beam). */
  morph: number;
  /** The beam's position along the edge while processing, -1…1. */
  sweep: number;
}
