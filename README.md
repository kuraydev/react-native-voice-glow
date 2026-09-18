# react-native-voice-glow 🎙️✨

> Sound-reactive glow for React Native — a centered, colorful beam along the bottom edge that rises and blooms with voice.

A [Skia](https://shopify.github.io/react-native-skia/) port of
[voice-glow](https://libraries.dev/voice) by [Jakub Antalik](https://github.com/Jakubantalik).
Same math, native renderer. Built for AI chat composers, voice assistants, and
anything that should feel like it's listening.

## ✨ Features

- 🎚️ **Real voice response** — RMS level + a three-band split (chest, vowels, sibilance), gated and envelope-followed so a shout rounds off instead of clipping
- 🌈 **Drifting palette** — lobes flow along the edge with a slow hue cycle
- 🤔 **Processing state** — the glow gathers into a beam that sweeps the edge while your model thinks
- 📐 **Three presets** — `default`, `pill`, `mobile`, each a full set of tuned geometry
- ♿️ **Reduce Motion aware** — no flow, no breathing, no sweep when the system asks
- 🔬 **Golden-tested** — the driver math is verified against vectors lifted from the upstream library

## 📦 Install

```bash
npm install react-native-voice-glow @shopify/react-native-skia
# optional: only if you want the built-in microphone hook
npm install react-native-audio-api
```

Needs a dev build (Skia is native) — Expo Go won't work.

## 🚀 Usage

```tsx
import { VoiceBeam, useMicrophone } from 'react-native-voice-glow';

function Composer({ thinking }: { thinking: boolean }) {
  const mic = useMicrophone();

  return (
    <VoiceBeam level={mic.level} bands={mic.bands} processing={thinking}>
      <ChatInput onFocus={mic.start} onBlur={mic.stop} />
    </VoiceBeam>
  );
}
```

Driving it from your own audio pipeline (a voice SDK, a remote stream)? Skip
the hook and pass a level yourself — anything roughly 0–1 works:

```tsx
<VoiceBeam level={myLevel} type="mobile" theme="light" />
```

## 🎛️ Props

Every knob is a prop; `type` and `theme` only supply defaults, so anything you
set explicitly wins.

| Prop | Default | What it does |
|---|---|---|
| `level` | `0` | Current voice level. The glow's height rides this. |
| `bands` | `[0,0,0]` | Three-band split; lobes lift with their band. |
| `processing` | `false` | Gather into a travelling beam. |
| `type` | `'default'` | `default` · `pill` · `mobile` |
| `theme` | `'dark'` | `dark` · `light` |
| `sensitivity` | `3.1` | Input gain. |
| `threshold` | `0.015` | Noise gate. |
| `attack` / `release` | `0.325` / `0.86` | Seconds up, seconds down. |
| `idle` | `0.23` | How lit it sits in silence. |
| `reach` / `spread` / `flow` / `bend` | `1.2` / `1.05` / `48` / `60` | Glow geometry and drift. |
| `bandStrength` … `bandAberration` | see `voiceDefaults` | The bright line riding the edge. |
| `paused` | `false` | Freeze the frame. |

Full list with docs: `VoiceConfig` in [`src/types.ts`](src/types.ts).

## 🔒 Permissions

`useMicrophone` needs the app to hold mic permission first:

- **iOS** — `NSMicrophoneUsageDescription` in `Info.plist`
- **Android** — `RECORD_AUDIO`

## 🧪 Verifying the port

The driver math isn't a hand transcription you have to trust — the pure
functions are lifted out of upstream's source, evaluated, and stored as golden
vectors:

```bash
npm run verify:golden   # 933 checks against voice-glow 0.2.0
npm run verify          # typecheck + lint + tests
```

Change a constant and the check fails, rather than the animation quietly
drifting from the web component.

## 🍎 SwiftUI

Same effect for iOS and macOS apps: [VoiceGlowKit](https://github.com/kuraydev/voice-glow-swift).

## 📄 License

MIT © [kuraydev](https://github.com/kuraydev) — ported from
[voice-glow](https://github.com/Jakubantalik/Libraries.dev) (MIT © Jakub Antalik).
