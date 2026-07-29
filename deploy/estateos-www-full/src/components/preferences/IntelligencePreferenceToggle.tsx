"use client";

import { Brain } from "lucide-react";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Compact on/off — white brain on Siri oil when enabled (matches mobile).
 */
export default function IntelligencePreferenceToggle({ className = "" }: { className?: string }) {
  const { enabled, setEnabled, hydrated } = useIntelligencePreference();
  const { dict } = useLocale();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={!hydrated}
      onClick={() => setEnabled(!enabled)}
      className={`group flex w-full items-center gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-left transition hover:border-[var(--eos-border-strong)] hover:brightness-110 disabled:opacity-60 ${className}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border transition duration-300 group-hover:scale-110 ${
          enabled
            ? "border-white/30 bg-[conic-gradient(from_210deg,#FF2D55,#BF5AF2,#5E5CE6,#64D2FF,#30D158,#FFD60A,#FF9F0A,#FF2D55)] text-white shadow-[0_0_18px_rgba(191,90,242,0.35)]"
            : "border-[var(--eos-border)] bg-[#3A3A3C] text-[#8E8E93]"
        }`}
      >
        <span
          className={`flex h-full w-full items-center justify-center ${
            enabled ? "bg-[#0B0B0F]/55 backdrop-blur-[1px]" : ""
          }`}
        >
          <Brain size={15} strokeWidth={1.9} aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold tracking-wide text-[var(--eos-text)]">
          {dict.intelligence.prefTitle}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-[var(--eos-muted)]">
          {enabled ? dict.intelligence.prefOnHint : dict.intelligence.prefOffHint}
        </span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-[#BF5AF2]" : "bg-[var(--eos-border-strong)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-[1.15rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
