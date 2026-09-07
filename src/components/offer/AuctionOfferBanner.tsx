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
  if (!Number.isNaN(date.getTime())) {
    const tag = locale === "pl" ? "pl-PL" : locale === "uk" ? "uk-UA" : "en-GB";
    return date.toLocaleString(tag, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return "—";
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
      className={`eos-offer-feature-banner eos-offer-feature-banner--auction group relative w-full overflow-hidden text-left ${
        isLive ? "is-live" : ""
      } ${isHero ? "eos-offer-feature-banner--hero" : ""}`}
      whileTap={{ scale: 0.99 }}
    >
      <span className="eos-offer-feature-banner__glass" aria-hidden />
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="eos-offer-feature-banner__icon">
          <Gavel size={22} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eos-offer-feature-banner-title">{copy.title}</p>
            {isLive ? (
              <span className="eos-offer-feature-banner__badge">{copy.liveBadge}</span>
            ) : null}
          </div>
          <p className="eos-offer-feature-banner-subtitle">
            {isLive
              ? copy.subtitleLive(priceLabel, event.bidCount)
              : copy.subtitleScheduled(formatDate(event.startsAt, locale))}
          </p>
        </div>

        <span className="eos-offer-feature-banner__cta">
          {copy.cta}
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </motion.button>
  );
}
