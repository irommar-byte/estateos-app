"use client";

import { motion } from "framer-motion";
import { ChevronRight, DoorOpen } from "lucide-react";
import type { OpenHouseEventRecord } from "@/lib/openHouseTypes";

type Copy = {
  title: string;
  subtitle: (date: string, spots: number) => string;
  cta: string;
};

type Props = {
  event: OpenHouseEventRecord;
  locale: "pl" | "en";
  copy: Copy;
  onPress: () => void;
  variant?: "hero" | "inline";
};

function formatNextSlot(iso: string | null, locale: "pl" | "en"): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "pl" ? "pl-PL" : "en-GB", {
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
      className={`group relative w-full overflow-hidden text-left transition-transform active:scale-[0.99] ${
        isHero
          ? "rounded-2xl border border-amber-400/35 bg-amber-500/12 px-4 py-3.5 shadow-[0_8px_32px_rgba(245,158,11,0.12)] backdrop-blur-2xl sm:px-5 sm:py-4"
          : "rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 sm:px-5"
      }`}
      animate={{
        opacity: [1, 0.88, 1],
        boxShadow: isHero
          ? [
              "0 8px 32px rgba(245,158,11,0.12)",
              "0 8px 40px rgba(245,158,11,0.28)",
              "0 8px 32px rgba(245,158,11,0.12)",
            ]
          : [
              "0 0 0 rgba(245,158,11,0)",
              "0 0 24px rgba(245,158,11,0.18)",
              "0 0 0 rgba(245,158,11,0)",
            ],
      }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-amber-400/0 via-amber-300/10 to-amber-400/0"
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative flex items-center gap-3 sm:gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/18 text-amber-400 ring-1 ring-amber-400/25 sm:h-12 sm:w-12">
          <DoorOpen size={22} strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`font-black uppercase tracking-[0.14em] ${
              isHero ? "text-[10px] text-amber-200/95 sm:text-[11px]" : "text-[10px] text-amber-600 sm:text-[11px]"
            }`}
          >
            {copy.title}
          </p>
          <p
            className={`mt-1 text-sm font-semibold leading-snug ${
              isHero ? "text-white/90" : "text-[var(--eos-text)]"
            }`}
          >
            {copy.subtitle(dateLabel, event.totalSpotsLeft)}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition group-hover:brightness-110 ${
            isHero ? "bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.35)]" : "bg-amber-500"
          }`}
        >
          {copy.cta}
          <ChevronRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </motion.button>
  );
}
