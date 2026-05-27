"use client";

import DisplayCurrencySwitcher from "@/components/preferences/DisplayCurrencySwitcher";
import CompactThemeSwitcher from "@/components/layout/CompactThemeSwitcher";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

export default function FloatingPreferencesDock() {
  const { dict } = useLocale();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[min(100vw-2rem,22rem)]">
      <div className="pointer-events-auto flex flex-col gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-glass)] p-2 shadow-[var(--eos-shadow-strong)] backdrop-blur-xl">
        <div className="space-y-1">
          <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            {dict.theme.label}
          </p>
          <CompactThemeSwitcher />
        </div>
        <div className="space-y-1">
          <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            {dict.nav.language}
          </p>
          <LanguageSwitcher />
        </div>
        <div className="space-y-1">
          <p className="px-1 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--eos-muted)]">
            {dict.currency.sectionTitle}
          </p>
          <DisplayCurrencySwitcher />
          <p className="px-1 text-[9px] leading-snug text-[var(--eos-subtle)]">{dict.currency.footer}</p>
        </div>
      </div>
    </div>
  );
}
