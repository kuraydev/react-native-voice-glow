import {
  Blur,
  Canvas,
  Group,
  Path,
  RadialGradient,
  Skia,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';

import { advance, bandPoints, emptyFrame, lobeSpan, multipliers, voiceLobes } from './driver';
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

  // Upstream's three multipliers: overall opacity, height, width. The lobe
  // sizes are RADII scaled by these, which is what makes the glow span the
  // whole host rather than sit in a puddle at its centre.
  const lit = clamp01(frame.level);
  const { glow, h: hMul, w: wMul } = multipliers(config, lit);

  const baseline = size.height;
  const centre =
    size.width / 2 + (frame.sweep * (lobeSpan(config) * config.processingTravel)) / 2;
  const span = lobeSpan(config);
  // Where a lobe's colour reaches full transparency, as a share of its radius.
  const fade = Math.min(0.95, Math.max(0.4, 0.7 * config.softness));

  // Bloom (widest, softest) → inner light → stroke, exactly upstream's stack.
  const LAYERS: Array<{ sw: number; sh: number; y: number; alpha: number; blur: number }> = [
    { sw: 1.15, sh: 1.5, y: 0, alpha: config.theme === 'dark' ? 0.72 : 0.46, blur: 32 },
    { sw: 0.9, sh: 0.9, y: 0, alpha: 0.4, blur: 18 },
    { sw: 1, sh: 1, y: 2, alpha: 0.46, blur: 11 },
  ];

  const lobesFor = (sw: number, sh: number, y: number) =>
    voiceLobes.map((lobe, index) => {
      const x = wrapX(lobe.x * config.lobeSpacing + frame.flowOffset, span);
      const band = frame.bands[lobe.band] ?? lit;
      // The band a lobe follows lifts it 0.6–1.3×; the envelope fades it at
      // the wrap so colours cycle through the centre.
      const lift =
        (config.bandsFollowVoice ? 0.6 + 0.7 * band : 1) * edgeEnvelope(x, span);
      return {
        key: index,
        color: config.colors[index % config.colors.length]!,
        cx: centre + x * wMul * config.scale,
        cy: baseline + y * config.scale,
        rx: lobe.w * sw * wMul * config.scale,
        ry: lobe.h * sh * hMul * lift * config.scale,
        lift,
      };
    });

  const band = useMemo(() => {
    if (config.bandStrength <= 0 || size.width === 0) return null;
    const points = bandPoints(config, frame, size.width, baseline, centre);
    const path = Skia.Path.Make();
    points.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
    return path;
  }, [config, frame, size.width, baseline, centre]);

  // The rim is gated on the bend: flat at silence, so nothing is drawn until
  // the voice lifts the ceiling.
  const bandStrength = config.bandStrength * lit * lit;
  const split = config.bandAberration * config.scale;
  const radius = config.radius > 0 ? config.radius : size.height / 2;

  return (
    <View style={style} onLayout={onLayout}>
      {children}
      <Canvas
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {/* Clipped to the host's rounded rect: the glow is light behind the
            surface, not a halo hanging off it. */}
        <Group
          clip={rrect(rect(0, 0, size.width, size.height), radius, radius)}
          blendMode={config.theme === 'dark' ? 'screen' : 'multiply'}
          opacity={glow}
        >
          {LAYERS.map((layer, li) => (
            <Group key={li} layer={<Blur blur={layer.blur * config.glowSize * config.scale} />}>
              {lobesFor(layer.sw, layer.sh, layer.y).map((lobe) =>
                lobe.lift <= 0.001 ? null : (
                  <Path
                    key={lobe.key}
                    path={ovalPath(lobe.cx, lobe.cy, lobe.rx, lobe.ry)}
                    opacity={layer.alpha}
                  >
                    <RadialGradient
                      c={vec(lobe.cx, lobe.cy)}
                      r={Math.max(lobe.rx, lobe.ry)}
                      colors={[lobe.color, `${lobe.color}00`]}
                      positions={[0, fade]}
                    />
                  </Path>
                ),
              )}
            </Group>
          ))}

          {/* The hot core the colours fan out from. */}
          <Path
            path={ovalPath(
              centre,
              baseline,
              30 * config.coreSize * wMul * config.scale,
              30 * config.coreSize * hMul * config.scale,
            )}
            opacity={(config.theme === 'dark' ? 0.16 : 0.24) * lit}
          >
            <RadialGradient
              c={vec(centre, baseline)}
              r={Math.max(30 * config.coreSize * wMul, 30 * config.coreSize * hMul) * config.scale}
              colors={
                config.theme === 'dark'
                  ? ['#FFFFFF', '#FFFFFF00']
                  : ['#000000', '#00000000']
              }
              positions={[0, 0.65]}
            />
          </Path>

          {band && bandStrength > 0.01 && (
            <Group>
              {config.bandAberration > 0 && (
                <Group layer={<Blur blur={2 * config.scale} />}>
                  <Group transform={[{ translateY: -split }]}>
                    <Path path={band} style="stroke" strokeWidth={1.4 * config.scale}
                          strokeCap="round" color={config.bandColors.above}
                          opacity={0.05 * bandStrength} />
                  </Group>
                  <Path path={band} style="stroke" strokeWidth={1.4 * config.scale}
                        strokeCap="round" color={config.bandColors.mid}
                        opacity={0.05 * bandStrength} />
                  <Group transform={[{ translateY: split }]}>
                    <Path path={band} style="stroke" strokeWidth={1.4 * config.scale}
                          strokeCap="round" color={config.bandColors.below}
                          opacity={0.05 * bandStrength} />
                  </Group>
                </Group>
              )}
              <Path path={band} style="stroke" strokeWidth={0.9 * config.scale} strokeCap="round"
                    color={config.bandColors.core} opacity={Math.min(1, 0.1 * bandStrength)} />
            </Group>
          )}
        </Group>
      </Canvas>
    </View>
  );
}

/** An ellipse of the given radii, centred on (cx, cy). */
function ovalPath(cx: number, cy: number, rx: number, ry: number) {
  const path = Skia.Path.Make();
  path.addOval({ x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 });
  return path;
}
