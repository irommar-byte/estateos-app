"use client";

import { useLocale } from "@/contexts/LocaleContext";
import { LOCALE_FLAGS, type Locale } from "@/i18n/config";
import EosSegmentedControl from "@/components/ui/EosSegmentedControl";

const LOCALE_LABELS: Record<Locale, { short: string; title: string }> = {
  pl: { short: "PL", title: "Polski" },
  en: { short: "EN", title: "English" },
  uk: { short: "UA", title: "Українська" },
};

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, dict } = useLocale();

  return (
    <div className={className}>
      <EosSegmentedControl<Locale>
        layoutId="estateos-locale-segment"
        value={locale}
        onChange={setLocale}
        ariaLabel={dict.nav.language}
        compact
        options={(["pl", "en", "uk"] as const).map((code) => ({
          value: code,
          label: LOCALE_LABELS[code].short,
          title: LOCALE_LABELS[code].title,
          icon: <span className="text-base leading-none">{LOCALE_FLAGS[code]}</span>,
        }))}
      />
    </div>
  );
}
