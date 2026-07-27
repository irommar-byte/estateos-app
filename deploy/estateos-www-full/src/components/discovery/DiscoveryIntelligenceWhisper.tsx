"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Variant = "nav" | "inline" | "map" | "drawer";

type Props = {
  title?: string;
  body: string;
  href?: string;
  variant?: Variant;
  className?: string;
};

/**
 * EstateOS™ Intelligence — quiet frosted whisper. One thought, no badge circus.
 */
export default function DiscoveryIntelligenceWhisper({
  title = "EstateOS™ Intelligence",
  body,
  href = "/moj-kierunek",
  variant = "inline",
  className = "",
}: Props) {
  const reduceMotion = useReducedMotion();
  const line = String(body || "").trim();
  if (!line) return null;

  if (variant === "nav") {
    return (
      <Link
        href={href}
        className={`group hidden max-w-[14rem] items-center gap-2 xl:flex ${className}`}
        title={line}
      >
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {!reduceMotion ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/35" />
          ) : null}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.45)]" />
        </span>
        <span className="truncate text-[10px] font-medium tracking-[0.02em] text-[var(--eos-muted)] transition group-hover:text-[var(--eos-text)]">
          {line}
        </span>
      </Link>
    );
  }

  const shell =
    variant === "map"
      ? "rounded-[1.35rem] border border-white/12 bg-[var(--eos-card)]/78 px-3.5 py-3 shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl"
      : variant === "drawer"
        ? "rounded-[1.35rem] border border-[var(--eos-border)] bg-[var(--eos-input)]/90 px-4 py-3.5 backdrop-blur-xl"
        : "rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-2xl dark:border-white/10";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className={`${shell} ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[var(--eos-muted)]">
        <Sparkles size={11} className="opacity-70" aria-hidden />
        {title}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--eos-text)]/78">{line}</p>
      {href ? (
        <Link
          href={href}
          className="mt-2.5 inline-flex text-[11px] font-medium tracking-wide text-[var(--eos-text)]/55 transition hover:text-[var(--eos-text)]"
        >
          Mój kierunek →
        </Link>
      ) : null}
    </motion.div>
  );
}
