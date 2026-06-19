"use client";

import { motion } from "framer-motion";
import { ChevronRight, Gavel } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { AuctionEventRecord } from "@/lib/auctionTypes";

type Copy = {
  title: string;
  subtitleLive: (price: string, bids: number) => string;
  subtitleScheduled: (date: string) => string;
  cta: string;
  liveBadge: string;
};

type Props = {
  event: AuctionEventRecord;
  locale: Locale;
  copy: Copy;
  onPress: () => void;
  variant?: "hero" | "inline";
};

function formatDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  return date.toLocaleString(tag, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(amount: number, currency: string, locale: Locale) {
  const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
  return `${Math.round(amount).toLocaleString(tag)} ${currency}`;
}

export default function AuctionOfferBanner({
  event,
  locale,
  copy,
  onPress,
  variant = "inline",
}: Props) {
  const isHero = variant === "hero";
  const isLive = event.status === "LIVE";
  const priceLabel = formatPrice(event.currentPrice || event.startPrice, event.currency, locale);

  return (
    <motion.button
      type="button"
      onClick={onPress}
      className={`eos-offer-feature-banner group relative w-full overflow-hidden text-left transition-transform active:scale-[0.99] ${
        isHero ? "eos-offer-feature-banner--hero" : ""
      } rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3.5 sm:px-5 sm:py-4`}
      whileTap={{ scale: 0.99 }}
    >
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-500 ring-1 ring-violet-500/20 sm:h-12 sm:w-12">
          <Gavel size={22} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eos-offer-feature-banner-title text-[13px] font-semibold tracking-tight eos-violet-accent-strong">
              {copy.title}
            </p>
            {isLive ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {copy.liveBadge}
              </span>
            ) : null}
          </div>
          <p className="eos-offer-feature-banner-subtitle mt-1 text-[13px] font-medium leading-snug text-[var(--eos-text)]">
            {isLive
              ? copy.subtitleLive(priceLabel, event.bidCount)
              : copy.subtitleScheduled(formatDate(event.startsAt, locale))}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white transition group-hover:bg-violet-500">
          {copy.cta}
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </motion.button>
  );
}
