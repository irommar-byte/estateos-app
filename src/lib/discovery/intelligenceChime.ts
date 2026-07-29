/**
 * Soft monastery-bowl style chime for EstateOS™ Intelligence.
 * Very quiet, long decay — never spammy.
 */
let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

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

export type IntelligenceChimeKind = "suggest" | "progress" | "celebrate";

export async function playIntelligenceChime(kind: IntelligenceChimeKind = "suggest") {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const now = Date.now();
  // At most once every 12s — silence is part of the craft.
  if (now - lastPlayedAt < 12_000) return;
  lastPlayedAt = now;

  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
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
