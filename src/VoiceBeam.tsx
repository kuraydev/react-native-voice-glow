import {
  Blur,
  Canvas,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { CEILING_HALF_WIDTH, CEILING_HEIGHT, advance, bandPoints, emptyFrame, lobeSpan } from './driver';
import { clamp01, edgeEnvelope, wrapX } from './math';
import { resolveConfig } from './presets';
import type { VoiceBeamTheme, VoiceBeamType, VoiceConfig, VoiceFrame } from './types';

export interface VoiceBeamProps extends Partial<VoiceConfig> {
  /** Latest microphone level, typically `useMicrophone().level`. */
  level?: number;
  /** Latest three-band split, typically `useMicrophone().bands`. */
  bands?: readonly number[];
  /** Preset shape. @default 'default' */
  type?: VoiceBeamType;
  /** @default 'dark' */
  theme?: VoiceBeamTheme;
  style?: ViewStyle;
  children?: React.ReactNode;
}

/**
 * A sound-reactive glow along a view's bottom edge: a centred, colourful beam
 * that rises and blooms with voice, and gathers into a travelling sweep while
 * you are thinking.
 *
 * ```tsx
 * const mic = useMicrophone();
 *
 * <VoiceBeam level={mic.level} bands={mic.bands} processing={thinking}>
 *   <ChatInput />
 * </VoiceBeam>
 * ```
 *
 * The glow paints behind and below `children` and never takes hit tests, so it
 * costs the layout nothing.
 */
export function VoiceBeam({
  level = 0,
  bands = [0, 0, 0],
  type = 'default',
  theme = 'dark',
  style,
  children,
  ...overrides
}: VoiceBeamProps) {
  const config = useMemo(
    () => resolveConfig(type, theme, overrides as Partial<VoiceConfig>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, theme, JSON.stringify(overrides)],
  );

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState<VoiceFrame>(emptyFrame);
  const [reduceMotion, setReduceMotion] = useState(false);

  const stateRef = useRef<VoiceFrame>(emptyFrame());
  const clockRef = useRef({ elapsed: 0, sweepPhase: 0 });
  const lastRef = useRef<number | null>(null);
  const inputRef = useRef({ level, bands });
  inputRef.current = { level, bands };

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => alive && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // One rAF loop drives the driver; React only sees the resolved frame.
  useEffect(() => {
    if (config.paused) return;
    let raf: number;
    const tick = (ts: number) => {
      const dt = lastRef.current === null ? 1 / 60 : (ts - lastRef.current) / 1000;
      lastRef.current = ts;
      const next = advance(
        stateRef.current,
        clockRef.current,
        dt,
        inputRef.current.level,
        inputRef.current.bands,
        { ...config, reducedMotion: config.reducedMotion || reduceMotion },
      );
      setFrame({ ...next, bands: [...next.bands] as [number, number, number] });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lastRef.current = null;
    };
  }, [config, reduceMotion]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  const bloomHeight = CEILING_HEIGHT * config.reach * config.scale * 2.2;
  const lit = clamp01(frame.level);
  const centre = size.width / 2 + frame.sweep * (lobeSpan(config) * config.processingTravel) / 2;
  const baseline = bloomHeight / 2;

  // Each lobe is one colour of the palette, offset around the ring and faded
  // out at the wrap edge so it never pops across.
  const span = lobeSpan(config);
  const lobes = config.colors.map((color, index) => {
    const slot = index - (config.colors.length - 1) / 2;
    const offset = wrapX(
      (slot * span) / Math.max(1, config.colors.length) + frame.flowOffset,
      span,
    );
    const envelope = edgeEnvelope(offset, span);
    const band = frame.bands[index % 3] ?? lit;
    const height =
      (CEILING_HEIGHT * config.reach * config.scale * (0.35 + 0.65 * lit) +
        config.bend * config.scale * lit * 0.5) *
      (0.7 + 0.3 * band);
    const width = CEILING_HALF_WIDTH * config.spread * config.scale * (0.6 + 0.4 * lit);
    return { color, envelope, height, width, x: centre + offset };
  });

  const band = useMemo(() => {
    if (config.bandStrength <= 0 || size.width === 0) return null;
    const points = bandPoints(config, frame, size.width, baseline, centre);
    const path = Skia.Path.Make();
    points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
    return path;
  }, [config, frame, size.width, baseline, centre]);

  const bandStrength = config.bandStrength * (0.2 + 0.8 * lit);
  const split = config.bandAberration * config.scale;

  return (
    <View style={style} onLayout={onLayout}>
      {children}
      <Canvas
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[styles.canvas, { height: bloomHeight, bottom: -bloomHeight / 2 }]}
      >
        <Group blendMode="plus">
          {lobes.map((lobe, i) =>
            lobe.envelope <= 0.001 ? null : (
              <Group key={i} layer={<Blur blur={18 * config.glowSize * config.scale} />}>
                <Path
                  path={ovalPath(lobe.x, baseline, lobe.width, lobe.height)}
                  opacity={lobe.envelope * (0.25 + 0.75 * lit)}
                >
                  <RadialGradient
                    c={vec(lobe.x, baseline)}
                    r={Math.max(lobe.width, lobe.height)}
                    colors={[lobe.color, `${lobe.color}00`]}
                  />
                </Path>
              </Group>
            ),
          )}

          {band && config.bandAberration > 0 && (
            <Group layer={<Blur blur={2.5 * config.scale} />}>
              <Group transform={[{ translateY: -split }]}>
                <Path path={band} style="stroke" strokeWidth={2.2 * config.scale} strokeCap="round"
                      color={config.bandColors.above} opacity={0.5 * bandStrength} />
              </Group>
              <Path path={band} style="stroke" strokeWidth={2.2 * config.scale} strokeCap="round"
                    color={config.bandColors.mid} opacity={0.5 * bandStrength} />
              <Group transform={[{ translateY: split }]}>
                <Path path={band} style="stroke" strokeWidth={2.2 * config.scale} strokeCap="round"
                      color={config.bandColors.below} opacity={0.5 * bandStrength} />
              </Group>
            </Group>
          )}

          {band && (
            <Path path={band} style="stroke" strokeWidth={1.4 * config.scale} strokeCap="round"
                  color={config.bandColors.core} opacity={Math.min(1, bandStrength)} />
          )}
        </Group>
      </Canvas>
    </View>
  );
}

function ovalPath(cx: number, cy: number, width: number, height: number) {
  const path = Skia.Path.Make();
  path.addOval({ x: cx - width / 2, y: cy - height, width, height: height * 2 });
  return path;
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
