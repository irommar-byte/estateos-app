"use client";

import { useLocale } from "@/contexts/LocaleContext";
import type { Locale } from "@/i18n/config";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, dict } = useLocale();

  const btn = (code: Locale, label: string) => (
    <button
      type="button"
      onClick={() => setLocale(code)}
      aria-pressed={locale === code}
      className={`min-h-[32px] min-w-[36px] rounded-full px-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
        locale === code
          ? "bg-[var(--eos-accent)] text-black shadow-[0_0_12px_rgba(16,185,129,0.35)]"
          : "text-[var(--eos-muted)] hover:text-[var(--eos-text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={dict.nav.language}
      className={`eos-segmented-control ${className}`}
    >
      {btn("pl", dict.nav.langPl)}
      {btn("en", dict.nav.langEn)}
    </div>
  );
}
