"use client";

import { motion } from "framer-motion";
import { ChevronRight, DoorOpen } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { OpenHouseEventRecord } from "@/lib/openHouseTypes";

type Copy = {
  title: string;
  subtitle: (date: string, spots: number) => string;
  cta: string;
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

export default function OpenHouseOfferBanner({
  event,
  locale,
  copy,
  onPress,
  variant = "inline",
}: Props) {
  const dateLabel = formatNextSlot(event.nextSlotStartsAt, locale);
  const isHero = variant === "hero";

  return (
    <motion.button
      type="button"
      onClick={onPress}
      className={`eos-offer-feature-banner group relative w-full overflow-hidden text-left transition-transform active:scale-[0.99] ${
        isHero ? "eos-offer-feature-banner--hero" : ""
      } rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3.5 sm:px-5 sm:py-4`}
      whileTap={{ scale: 0.99 }}
    >
      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20 sm:h-12 sm:w-12">
          <DoorOpen size={22} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="eos-offer-feature-banner-title text-[13px] font-semibold tracking-tight eos-amber-accent">
            {copy.title}
          </p>
          <p className="eos-offer-feature-banner-subtitle mt-1 text-[13px] font-medium leading-snug text-[var(--eos-text)]">
            {copy.subtitle(dateLabel, event.totalSpotsLeft)}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-3.5 py-2 text-[13px] font-semibold text-white transition group-hover:bg-amber-400">
          {copy.cta}
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </motion.button>
  );
}
