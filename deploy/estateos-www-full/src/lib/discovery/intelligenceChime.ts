/**
 * Soft monastery-bowl style chime for EstateOS™ Intelligence.
 * Learn sound is a distinct glass-drip + oil shimmer — quieter, shorter, memorable.
 */
let audioCtx: AudioContext | null = null;
let lastPresentAt = 0;
let lastLearnAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export type IntelligenceChimeKind = "suggest" | "progress" | "celebrate" | "learn";

const PRESENT_DEBOUNCE_MS = 12_000;
/** Learn may fire more often — still soft, never a click track. */
const LEARN_DEBOUNCE_MS = 1_600;

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    freq: number;
    type?: OscillatorType;
    peak: number;
    attack: number;
    hold: number;
    release: number;
    start: number;
    detune?: number;
  },
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(opts.freq, opts.start);
  if (opts.detune) osc.detune.setValueAtTime(opts.detune, opts.start);
  gain.gain.setValueAtTime(0.0001, opts.start);
  gain.gain.exponentialRampToValueAtTime(opts.peak, opts.start + opts.attack);
  gain.gain.exponentialRampToValueAtTime(opts.peak * 0.55, opts.start + opts.attack + opts.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.attack + opts.hold + opts.release);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(opts.start);
  osc.stop(opts.start + opts.attack + opts.hold + opts.release + 0.05);
}

/**
 * Distinctive “brain absorbed a decision” cue:
 * glass drip → brief harmonic bloom → soft oil shimmer.
 */
function playLearnSound(ctx: AudioContext) {
  const t0 = ctx.currentTime + 0.012;
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  // Glass drip — falls slightly like a drop into iridescent oil
  const drip = ctx.createOscillator();
  const dripGain = ctx.createGain();
  drip.type = "sine";
  drip.frequency.setValueAtTime(920, t0);
  drip.frequency.exponentialRampToValueAtTime(540, t0 + 0.22);
  dripGain.gain.setValueAtTime(0.0001, t0);
  dripGain.gain.exponentialRampToValueAtTime(0.055, t0 + 0.018);
  dripGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
  drip.connect(dripGain);
  dripGain.connect(master);
  drip.start(t0);
  drip.stop(t0 + 0.5);

  // Harmonic bloom — soft neural chord
  tone(ctx, master, {
    freq: 523.25,
    peak: 0.018,
    attack: 0.04,
    hold: 0.12,
    release: 0.85,
    start: t0 + 0.05,
  });
  tone(ctx, master, {
    freq: 659.25,
    peak: 0.014,
    attack: 0.05,
    hold: 0.1,
    release: 0.95,
    start: t0 + 0.09,
  });
  tone(ctx, master, {
    freq: 783.99,
    peak: 0.011,
    attack: 0.06,
    hold: 0.08,
    release: 1.05,
    start: t0 + 0.14,
    detune: 6,
  });

  // Oil shimmer — tiny band-passed noise sparkle
  const bufferSize = Math.floor(ctx.sampleRate * 0.28);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.setValueAtTime(2400, t0);
  band.Q.setValueAtTime(4.2, t0);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.012, t0 + 0.03);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
  noise.connect(band);
  band.connect(noiseGain);
  noiseGain.connect(master);
  noise.start(t0 + 0.02);
  noise.stop(t0 + 0.35);

  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.03);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.55);
}

export async function playIntelligenceChime(kind: IntelligenceChimeKind = "suggest") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const now = Date.now();
  if (kind === "learn") {
    if (now - lastLearnAt < LEARN_DEBOUNCE_MS) return;
    lastLearnAt = now;
  } else {
    if (now - lastPresentAt < PRESENT_DEBOUNCE_MS) return;
    lastPresentAt = now;
  }

  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    return;
  }

  if (kind === "learn") {
    playLearnSound(ctx);
    return;
  }

  const t0 = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);

  const freqs =
    kind === "celebrate"
      ? [220, 330, 440, 554]
      : kind === "progress"
        ? [196, 294, 392]
        : [174.6, 261.6, 349.2];
  const peak = kind === "celebrate" ? 0.032 : kind === "progress" ? 0.028 : 0.022;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak / (i + 1.2), t0 + 0.04 + i * 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8 + i * 0.35);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + 3.4 + i * 0.4);
  });

  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(1, t0 + 0.04);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
}
