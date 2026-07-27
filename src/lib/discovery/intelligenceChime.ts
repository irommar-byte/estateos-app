import { Audio } from 'expo-av';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Soft temple-bowl style chime for EstateOS™ Intelligence.
 * Debounced 12s — silence is part of the craft.
 * Uses a tiny generated WAV via expo-av (no asset file).
 */
let lastPlayedAt = 0;
let reduceMotion = false;

AccessibilityInfo.isReduceMotionEnabled?.()
  .then((v) => {
    reduceMotion = Boolean(v);
  })
  .catch(() => {});

AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
  reduceMotion = Boolean(v);
});

function buildToneWavUri(freqs: number[], peak: number): string {
  const sampleRate = 22050;
  const durationSec = 1.35;
  const n = Math.floor(sampleRate * durationSec);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sampleRate;
    let sample = 0;
    freqs.forEach((freq, idx) => {
      const env = Math.exp(-t * (2.4 + idx * 0.35));
      sample += Math.sin(2 * Math.PI * freq * t) * env * (peak / (idx + 1.2));
    });
    samples[i] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  }

  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : (() => {
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
          let out = '';
          for (let i = 0; i < bytes.length; i += 3) {
            const a = bytes[i];
            const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
            const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
            const triple = (a << 16) | (b << 8) | c;
            out += alphabet[(triple >> 18) & 63];
            out += alphabet[(triple >> 12) & 63];
            out += i + 1 < bytes.length ? alphabet[(triple >> 6) & 63] : '=';
            out += i + 2 < bytes.length ? alphabet[triple & 63] : '=';
          }
          return out;
        })();
  return `data:audio/wav;base64,${b64}`;
}

export async function playIntelligenceChime(kind: 'suggest' | 'progress' = 'suggest') {
  if (reduceMotion) return;
  const now = Date.now();
  if (now - lastPlayedAt < 12_000) return;
  lastPlayedAt = now;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Continue — mode setup is best-effort.
  }

  const freqs = kind === 'progress' ? [196, 294, 392] : [174.6, 261.6, 349.2];
  const peak = kind === 'progress' ? 0.028 : 0.022;
  const uri = buildToneWavUri(freqs, peak);

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, volume: Platform.OS === 'ios' ? 0.35 : 0.28 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // Quiet failure — chime must never crash UI.
  }
}
