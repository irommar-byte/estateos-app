"use client";

import { motion } from "framer-motion";
import { ChevronRight, DoorOpen } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { OpenHouseEventRecord } from "@/lib/openHouseTypes";

type Copy = {
  title: string;
  subtitle: (date: string, spots: number) => string;
  cta: string;
  liveBadge: string;
};

type Props = {
  event: OpenHouseEventRecord;
  locale: Locale;
  copy: Copy;
  onPress: () => void;
  variant?: "hero" | "inline";
};

function formatNextSlot(iso: string | null, locale: Locale): string {
  if (!iso) return "—";
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

export function isOpenHouseLive(event: OpenHouseEventRecord, nowMs = Date.now()): boolean {
  return (event.slots || []).some((slot) => {
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    return Number.isFinite(start) && Number.isFinite(end) && start <= nowMs && nowMs <= end;
  });
}

export default function OpenHouseOfferBanner({
  event,
  locale,
  copy,
  onPress,
  variant = "inline",
}: Props) {
  const dateLabel = formatNextSlot(event.nextSlotStartsAt, locale);
  const isHero = variant === "hero";
  const isLive = isOpenHouseLive(event);

  return (
    <motion.button
      type="button"
      onClick={onPress}
      className={`eos-offer-feature-banner eos-offer-feature-banner--openhouse group relative w-full overflow-hidden text-left ${
        isLive ? "is-live" : ""
      } ${isHero ? "eos-offer-feature-banner--hero" : ""}`}
      whileTap={{ scale: 0.99 }}
    >
      <span className="eos-offer-feature-banner__glass" aria-hidden />
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="eos-offer-feature-banner__icon">
          <DoorOpen size={22} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="eos-offer-feature-banner-title">{copy.title}</p>
            {isLive ? (
              <span className="eos-offer-feature-banner__badge">{copy.liveBadge}</span>
            ) : null}
          </div>
          <p className="eos-offer-feature-banner-subtitle">
            {copy.subtitle(dateLabel, event.totalSpotsLeft)}
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
