"use client";

import { Brain } from "lucide-react";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { useLocale } from "@/contexts/LocaleContext";

/**
 * Compact on/off control for EstateOS™ Inteligence in display settings.
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
      className={`flex w-full items-center gap-3 rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5 text-left transition hover:border-[var(--eos-border-strong)] disabled:opacity-60 ${className}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          enabled
            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-400"
            : "border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)]"
        }`}
      >
        <Brain size={15} strokeWidth={1.75} aria-hidden />
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
          enabled ? "bg-emerald-500" : "bg-[var(--eos-border-strong)]"
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
