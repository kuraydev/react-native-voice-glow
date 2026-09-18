import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VoiceBeam, useMicrophone, type VoiceBeamTheme, type VoiceBeamType } from 'react-native-voice-glow';

const PRESETS: VoiceBeamType[] = ['default', 'pill', 'mobile'];
const THEMES: VoiceBeamTheme[] = ['dark', 'light'];

/**
 * A playground for the beam: drive it from the microphone or a simulated
 * level, flip presets and themes, and watch the knobs move the picture.
 */
export default function Demo() {
  const mic = useMicrophone();
  const [useMic, setUseMic] = useState(false);
  const [simulated, setSimulated] = useState(0.45);
  const [processing, setProcessing] = useState(false);
  const [type, setType] = useState<VoiceBeamType>('default');
  const [theme, setTheme] = useState<VoiceBeamTheme>('dark');

  const level = useMic ? mic.level : simulated;
  const bands: [number, number, number] = useMic
    ? mic.bands
    : [simulated, simulated * 0.8, simulated * 0.5];

  const dark = theme === 'dark';
  const toggleMic = (on: boolean) => {
    setUseMic(on);
    on ? void mic.start() : mic.stop();
  };

  return (
    <SafeAreaView style={[styles.root, dark ? styles.rootDark : styles.rootLight]}>
      <View style={styles.stage}>
        <VoiceBeam
          level={level}
          bands={bands}
          processing={processing}
          type={type}
          theme={theme}
          style={styles.beam}
        >
          <View style={[styles.composer, dark ? styles.composerDark : styles.composerLight]}>
            <Text style={[styles.composerText, dark ? styles.textDark : styles.textLight]}>
              {useMic ? status(mic) : 'Ask anything…'}
            </Text>
          </View>
        </VoiceBeam>
      </View>

      <ScrollView style={styles.controls} contentContainerStyle={styles.controlsContent}>
        <Row label="Use microphone">
          <Switch value={useMic} onValueChange={toggleMic} />
        </Row>
        <Row label="Processing">
          <Switch value={processing} onValueChange={setProcessing} />
        </Row>

        <Row label="Preset">
          <Segmented options={PRESETS} value={type} onChange={setType} dark={dark} />
        </Row>
        <Row label="Theme">
          <Segmented options={THEMES} value={theme} onChange={setTheme} dark={dark} />
        </Row>

        {!useMic && (
          <Row label={`Level ${simulated.toFixed(2)}`}>
            <Segmented
              options={[0, 0.25, 0.45, 0.7, 1]}
              value={simulated}
              onChange={setSimulated}
              dark={dark}
              format={(v) => String(v)}
            />
          </Row>
        )}

        {mic.error ? <Text style={styles.error}>{mic.error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function status(mic: ReturnType<typeof useMicrophone>) {
  if (mic.state === 'live') return `Listening — ${mic.level.toFixed(2)}`;
  if (mic.state === 'denied') return 'Microphone permission denied';
  if (mic.state === 'failed') return 'Microphone unavailable';
  return 'Microphone idle';
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  dark,
  format = (v: T) => String(v),
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  dark: boolean;
  format?: (v: T) => string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            style={[
              styles.segment,
              active && (dark ? styles.segmentActiveDark : styles.segmentActiveLight),
            ]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {format(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootDark: { backgroundColor: '#000' },
  rootLight: { backgroundColor: '#F4F4F6' },
  stage: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: 40 },
  beam: { width: '100%' },
  composer: {
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  composerDark: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
  composerLight: { backgroundColor: '#FFF', borderColor: 'rgba(0,0,0,0.08)' },
  composerText: { fontSize: 15 },
  textDark: { color: 'rgba(255,255,255,0.7)' },
  textLight: { color: 'rgba(0,0,0,0.6)' },
  controls: { maxHeight: 280, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)' },
  controlsContent: { padding: 18, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#8E8E93', fontSize: 14, flexShrink: 0 },
  segmented: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  segment: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(128,128,128,0.18)' },
  segmentActiveDark: { backgroundColor: 'rgba(255,255,255,0.22)' },
  segmentActiveLight: { backgroundColor: 'rgba(0,0,0,0.14)' },
  segmentText: { color: '#8E8E93', fontSize: 13 },
  segmentTextActive: { color: '#FFF', fontWeight: '600' },
  error: { color: '#FF6B6B', fontSize: 12 },
});
