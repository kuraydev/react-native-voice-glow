import { useCallback, useEffect, useRef, useState } from 'react';

import { BANDS, BASE_GAIN, BAND_GAIN, FFT_SIZE, SMOOTHING_TIME_CONSTANT, bandsFrom, levelFrom } from './math';

export type MicrophoneState = 'idle' | 'live' | 'denied' | 'failed';

export interface UseMicrophoneOptions {
  /** Input gain applied to the level and bands. @default 3.1 */
  sensitivity?: number;
  /** Start listening as soon as the hook mounts. @default false */
  autoStart?: boolean;
}

export interface UseMicrophoneResult {
  state: MicrophoneState;
  /** Latest RMS level, gained by `sensitivity`. Feed straight to `<VoiceBeam level>`. */
  level: number;
  /** Latest three-band split. Feed straight to `<VoiceBeam bands>`. */
  bands: [number, number, number];
  /** Why the mic failed, when `state` is `failed`. */
  error?: string;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * A live microphone read through `react-native-audio-api`, producing the same
 * level and band numbers the web component works from.
 *
 * The dependency is optional and loaded lazily: an app that drives the beam
 * from its own audio pipeline (a voice SDK, a remote stream) never installs it.
 * Permission is the app's job — add `NSMicrophoneUsageDescription` on iOS and
 * `RECORD_AUDIO` on Android, and request it before calling `start()`.
 */
export function useMicrophone(options: UseMicrophoneOptions = {}): UseMicrophoneResult {
  const { sensitivity = 3.1, autoStart = false } = options;

  const [state, setState] = useState<MicrophoneState>('idle');
  const [error, setError] = useState<string | undefined>();
  const [level, setLevel] = useState(0);
  const [bands, setBands] = useState<[number, number, number]>([0, 0, 0]);

  const contextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const sensitivityRef = useRef(sensitivity);
  sensitivityRef.current = sensitivity;

  const stop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    try {
      contextRef.current?.close?.();
    } catch {
      /* already gone */
    }
    contextRef.current = null;
    analyserRef.current = null;
    setLevel(0);
    setBands([0, 0, 0]);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (analyserRef.current) return;
    try {
      const audioApi = await import('react-native-audio-api').catch(() => null);
      if (!audioApi) {
        setError(
          'react-native-audio-api is not installed. Install it, or drive <VoiceBeam level> from your own audio source.',
        );
        setState('failed');
        return;
      }

      const ctx = new audioApi.AudioContext();
      const stream = await audioApi.AudioManager?.requestRecordingPermissions?.();
      if (stream === false) {
        setState('denied');
        return;
      }

      const recorder = ctx.createRecorderAdapterNode
        ? ctx.createRecorderAdapterNode()
        : await ctx.createMediaStreamSource?.(await audioApi.getMicrophoneStream?.());

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
      recorder?.connect?.(analyser);

      contextRef.current = ctx;
      analyserRef.current = analyser;
      setError(undefined);
      setState('live');

      const time = new Float32Array(analyser.fftSize);
      const freq = new Uint8Array(analyser.frequencyBinCount ?? analyser.fftSize / 2);

      const read = () => {
        const node = analyserRef.current;
        if (!node) return;
        node.getFloatTimeDomainData(time);
        node.getByteFrequencyData(freq);
        setLevel(levelFrom(time, sensitivityRef.current));
        setBands(
          bandsFrom(freq, ctx.sampleRate ?? 48000, node.fftSize, sensitivityRef.current),
        );
        frameRef.current = requestAnimationFrame(read);
      };
      frameRef.current = requestAnimationFrame(read);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('failed');
    }
  }, []);

  useEffect(() => {
    if (autoStart) void start();
    return stop;
  }, [autoStart, start, stop]);

  return { state, level, bands, error, start, stop };
}

export { BANDS, BASE_GAIN, BAND_GAIN, FFT_SIZE, SMOOTHING_TIME_CONSTANT };
