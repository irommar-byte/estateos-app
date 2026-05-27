"use client";

import { useLocale } from "@/contexts/LocaleContext";
import type { Locale } from "@/i18n/config";
import EosSegmentedControl from "@/components/ui/EosSegmentedControl";

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
        options={[
          { value: "pl", label: dict.nav.langPl, title: dict.nav.langPl },
          { value: "en", label: dict.nav.langEn, title: dict.nav.langEn },
        ]}
      />
    </div>
  );
}
