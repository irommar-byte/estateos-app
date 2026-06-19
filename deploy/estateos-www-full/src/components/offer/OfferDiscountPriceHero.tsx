"use client";

import { motion } from "framer-motion";
import { useLocale } from "@/contexts/LocaleContext";
import { numberFormatLocale } from "@/i18n/config";

type Props = {
  listPricePln: number;
  currentPrimary: string;
  discountPercent: number;
  className?: string;
};

export default function OfferDiscountPriceHero({
  listPricePln,
  currentPrimary,
  discountPercent,
  className = "",
}: Props) {
  const { locale } = useLocale();
  const dateTag = numberFormatLocale(locale);
  const listLabel =
    locale === "pl" ? "Cena wystawienia" : locale === "uk" ? "Ціна публікації" : "Listed at";
  const listFormatted =
    new Intl.NumberFormat(dateTag, { maximumFractionDigits: 0 }).format(Math.round(listPricePln)) + " PLN";
  const badge =
    locale === "pl"
      ? `−${discountPercent}%`
      : locale === "uk"
        ? `−${discountPercent}%`
        : `−${discountPercent}%`;

  return (
    <div className={`space-y-2 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-400"
      >
        {badge}
      </motion.div>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-light tabular-nums text-[var(--eos-muted)] line-through decoration-red-500/80 decoration-2 sm:text-3xl">
          {listFormatted}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eos-subtle)]">{listLabel}</p>
      </div>
      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-4xl font-light tracking-tighter text-emerald-500 sm:text-6xl md:text-7xl">
        <span>{currentPrimary}</span>
      </h2>
    </div>
  );
}
