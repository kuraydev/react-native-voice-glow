import type { VoiceBeamTheme, VoiceBeamType, VoiceConfig } from './types';

export const darkPalette = ['#FF6B35', '#FF3B87', '#9C59FF', '#3B9EFF'];
export const lightPalette = ['#FF854A', '#FF5494', '#AB70FF', '#4FABFF'];

export const darkBandColors = {
  core: '#FFFFFF',
  above: '#9ECCFF',
  mid: '#FFC7F0',
  below: '#FFB87A',
};

export const lightBandColors = {
  core: '#FFFFFF',
  above: '#8CBDFF',
  mid: '#FFB3E6',
  below: '#FFA366',
};

/** Upstream's defaults, one place. */
export const voiceDefaults: VoiceConfig = {
  sensitivity: 3.1,
  threshold: 0.015,
  attack: 0.325,
  release: 0.86,
  idle: 0.23,
  breatheDuration: 5.2,

  scale: 1,
  reach: 1.2,
  spread: 1.05,
  flow: 48,
  bend: 60,
  glowSize: 1,
  lobeSpacing: 0.85,

  bandStrength: 1.55,
  bandWidth: 2.15,
  bandPosition: 0.35,
  bandCurve: 1.75,
  bandSpread: 0.87,
  bandSkew: 0.12,
  bandOffset: -27,
  bandTail: 0.59,
  bandTailPosition: 0.67,
  bandTailCurve: 2.4,
  bandTailOverflow: 15,
  bandAberration: 0.89,

  processing: false,
  processingDuration: 1.1,
  processingLevel: 0.55,
  processingTravel: 1.55,
  processingCurve: 2.1,
  processingEase: 0.42,
  cornerFollow: 0.45,

  theme: 'dark',
  hueRange: 26,
  hueDuration: 12,
  staticColors: false,
  colors: darkPalette,
  bandColors: darkBandColors,

  radius: 0,
  paused: false,
  reducedMotion: false,
};

/** What each `type` retunes. An explicit prop always wins over these. */
export const voiceTypePresets: Record<VoiceBeamType, Partial<VoiceConfig>> = {
  default: {},
  pill: {
    scale: 0.45,
    glowSize: 0.95,
    reach: 1.35,
    spread: 1.1,
    flow: 0,
    bend: 23,
    bandWidth: 1.85,
    bandCurve: 1.95,
    bandSpread: 0.38,
    bandOffset: -16,
    bandTail: 0,
    processingTravel: 2,
    cornerFollow: 0,
    lobeSpacing: 0.45,
  },
  mobile: {
    scale: 1.25,
    spread: 0.45,
    reach: 3,
    flow: 60,
    bend: 70,
    bandWidth: 2.4,
    bandCurve: 1.55,
    bandSpread: 0.9,
    bandOffset: -50,
    bandTail: 0.62,
    bandTailPosition: 0.42,
    bandTailCurve: 2.7,
    bandTailOverflow: 22,
    processingDuration: 1.05,
    processingLevel: 0.35,
    processingTravel: 1,
    cornerFollow: 0.4,
  },
};

const themeOverrides: Record<VoiceBeamTheme, Partial<VoiceConfig>> = {
  dark: {},
  light: {
    reach: 1.8,
    spread: 0.8,
    colors: lightPalette,
    bandColors: lightBandColors,
  },
};

/** Defaults → theme → type → explicit props. */
export function resolveConfig(
  type: VoiceBeamType = 'default',
  theme: VoiceBeamTheme = 'dark',
  overrides: Partial<VoiceConfig> = {},
): VoiceConfig {
  return {
    ...voiceDefaults,
    theme,
    ...themeOverrides[theme],
    ...voiceTypePresets[type],
    ...overrides,
  };
}
