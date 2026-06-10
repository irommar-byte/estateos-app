"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, DoorOpen, Gavel, Sparkles } from "lucide-react";

export type ProToolIconKind = "crown" | "door" | "gavel";

type Props = {
  icon: ProToolIconKind;
  title: string;
  subtitle: string;
  badgeLabel?: string;
  onClick?: () => void;
  comingSoon?: boolean;
  soonLabel?: string;
};

function AnimatedIcon({ kind }: { kind: ProToolIconKind }) {
  const reduceMotion = useReducedMotion();

  const icon =
    kind === "crown" ? (
      <Crown size={22} strokeWidth={2.2} />
    ) : kind === "door" ? (
      <DoorOpen size={22} strokeWidth={2.2} />
    ) : (
      <Gavel size={22} strokeWidth={2.2} />
    );

  if (reduceMotion) {
    return icon;
  }

  if (kind === "crown") {
    return (
      <motion.span
        className="inline-flex"
        animate={{ y: [0, -2, 0], rotate: [0, 4, -3, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {icon}
      </motion.span>
    );
  }

  if (kind === "door") {
    return (
      <motion.span
        className="inline-flex origin-left"
        animate={{ rotate: [0, -8, 0, 6, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {icon}
      </motion.span>
    );
  }

  return (
    <motion.span
      className="inline-flex origin-bottom"
      animate={{ rotate: [0, -18, 0, -12, 0], y: [0, 1, 0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
    >
      {icon}
    </motion.span>
  );
}

function BadgeShell({
  children,
  onClick,
  comingSoon,
  soonLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  comingSoon?: boolean;
  soonLabel?: string;
}) {
  const sharedClass =
    "group relative h-full w-full overflow-hidden rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#1a1508] via-[#0a0a0a] to-[#050505] p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(212,175,55,0.15)] sm:p-5";

  const inner = (
    <>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#D4AF37]/10 blur-2xl" />
      {comingSoon ? (
        <span className="absolute right-3 top-3 z-10 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#F9E498]">
          {soonLabel ?? "Wkrótce"}
        </span>
      ) : null}
      {children}
    </>
  );

  if (comingSoon || !onClick) {
    return (
      <div
        className={`${sharedClass} cursor-default opacity-85`}
        aria-disabled={comingSoon ? true : undefined}
      >
        {inner}
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={sharedClass}
    >
      {inner}
    </motion.button>
  );
}

export default function ProToolBadge({
  icon,
  title,
  subtitle,
  badgeLabel = "Ekskluzywne narzędzie Pro",
  onClick,
  comingSoon = false,
  soonLabel,
}: Props) {
  return (
    <BadgeShell onClick={onClick} comingSoon={comingSoon} soonLabel={soonLabel}>
      <div className="relative flex h-full min-h-[108px] items-start gap-3 sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.2)]">
          <AnimatedIcon kind={icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#D4AF37]/90">
            {badgeLabel}
          </p>
          <h3 className="mt-1 text-xs font-black uppercase leading-snug tracking-[0.1em] text-white/95 sm:text-sm sm:tracking-[0.12em]">
            {title}
          </h3>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">{subtitle}</p>
        </div>
        {!comingSoon ? (
          <Sparkles
            size={16}
            className="shrink-0 text-emerald-500/80 opacity-0 transition-opacity group-hover:opacity-100"
          />
        ) : null}
      </div>
    </BadgeShell>
  );
}
