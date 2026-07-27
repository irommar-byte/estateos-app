"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Props = {
  offerId: number | string;
};

/**
 * One calm “why this listing” line on offer detail — Apple Intelligence restraint.
 */
export default function DiscoveryOfferExplainer({ offerId }: Props) {
  const reduceMotion = useReducedMotion();
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(offerId);
    if (!Number.isFinite(id) || id <= 0) return;
    let cancelled = false;

    void fetch(`/api/discovery/for-you?offerId=${id}&limit=1`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 401 || !res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const line = data?.explain?.reason || null;
        if (typeof line === "string" && line.trim()) setReason(line.trim());
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [offerId]);

  if (!reason) return null;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-3.5"
    >
      <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-emerald-500/90 dark:text-emerald-300/85">
        <Sparkles size={11} aria-hidden />
        EstateOS™ Inteligence
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--eos-text)]/80">{reason}</p>
    </motion.div>
  );
}
