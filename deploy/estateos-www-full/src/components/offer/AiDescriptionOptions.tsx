"use client";

import { DESCRIPTION_LENGTH_PRESETS } from "@/lib/listingDescriptionLength";

type Props = {
  targetLength: number;
  useEmojis: boolean;
  onTargetLength: (value: number) => void;
  onUseEmojis: (value: boolean) => void;
  lengthLabel: string;
  emoticonsLabel: string;
  variant?: "light" | "dark";
};

export default function AiDescriptionOptions({
  targetLength,
  useEmojis,
  onTargetLength,
  onUseEmojis,
  lengthLabel,
  emoticonsLabel,
  variant = "dark",
}: Props) {
  const dark = variant === "dark";
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`text-[10px] font-black uppercase tracking-[0.16em] ${
            dark ? "text-zinc-400" : "text-[var(--eos-muted)]"
          }`}
        >
          {lengthLabel.replace("{n}", String(targetLength))}
        </p>
        <label
          className={`inline-flex items-center gap-2 text-[11px] font-semibold ${
            dark ? "text-zinc-300" : "text-[var(--eos-text)]"
          }`}
        >
          <input
            type="checkbox"
            checked={useEmojis}
            onChange={(e) => onUseEmojis(e.target.checked)}
          />
          {emoticonsLabel}
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DESCRIPTION_LENGTH_PRESETS.map((n) => {
          const active = targetLength === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onTargetLength(n)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide transition ${
                active
                  ? "bg-emerald-500 text-black"
                  : dark
                    ? "border border-white/10 bg-white/5 text-zinc-300 hover:border-emerald-500/40"
                    : "border border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-text)] hover:border-emerald-500/40"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
