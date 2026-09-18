export { VoiceBeam } from './VoiceBeam';
export type { VoiceBeamProps } from './VoiceBeam';

export { useMicrophone } from './useMicrophone';
export type { MicrophoneState, UseMicrophoneOptions, UseMicrophoneResult } from './useMicrophone';

export {
  resolveConfig,
  voiceDefaults,
  voiceTypePresets,
  darkPalette,
  lightPalette,
  darkBandColors,
  lightBandColors,
} from './presets';

export { advance, bandPoints, emptyFrame, lobeSpan, BAND_SAMPLES, CEILING_HALF_WIDTH, CEILING_HEIGHT, LOBE_SPACING } from './driver';

export {
  bandsFrom,
  bell,
  clamp01,
  edgeEnvelope,
  follow,
  levelFrom,
  pingPong,
  shape,
  tailLift,
  wrapX,
  BANDS,
  BASE_GAIN,
  BAND_GAIN,
  FFT_SIZE,
  SMOOTHING_TIME_CONSTANT,
} from './math';

export type {
  VoiceBandColors,
  VoiceBeamTheme,
  VoiceBeamType,
  VoiceConfig,
  VoiceFrame,
} from './types';
