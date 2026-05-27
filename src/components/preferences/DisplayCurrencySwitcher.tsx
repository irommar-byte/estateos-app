"use client";

import { Banknote, Euro, Tag } from "lucide-react";
import { useDisplayCurrency } from "@/contexts/DisplayCurrencyContext";
import { useLocale } from "@/contexts/LocaleContext";
import type { DisplayCurrencyPreference } from "@/lib/money/types";
import EosSegmentedControl from "@/components/ui/EosSegmentedControl";

export default function DisplayCurrencySwitcher({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useDisplayCurrency();
  const { dict } = useLocale();

  const options: {
    value: DisplayCurrencyPreference;
    label: string;
    icon: React.ReactNode;
    title: string;
  }[] = [
    {
      value: "PLN",
      label: dict.currency.shortPln,
      icon: <Banknote className="size-3.5" aria-hidden />,
      title: dict.currency.labelPln,
    },
    {
      value: "EUR",
      label: dict.currency.shortEur,
      icon: <Euro className="size-3.5" aria-hidden />,
      title: dict.currency.labelEur,
    },
    {
      value: "LISTING",
      label: dict.currency.shortListing,
      icon: <Tag className="size-3.5" aria-hidden />,
      title: dict.currency.labelListing,
    },
  ];

  return (
    <div className={className}>
      <EosSegmentedControl
        layoutId="estateos-currency-segment"
        value={preference}
        onChange={setPreference}
        options={options}
        ariaLabel={dict.currency.sectionTitle}
        compact
      />
    </div>
  );
}
