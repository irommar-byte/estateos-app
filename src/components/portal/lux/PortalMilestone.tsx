"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

type Stored = { stage: number; docs: boolean };

/**
 * Chwila, gdy coś się domyka: zakończony etap albo komplet dokumentów.
 * Pokazywana raz (pamięć w przeglądarce), przy pierwszej wizycie tylko zapamiętujemy stan.
 */
export default function PortalMilestone({
  token,
  stageIndex,
  stageLabels,
  docsComplete,
  agentFirst,
}: {
  token: string;
  stageIndex: number;
  stageLabels: string[];
  docsComplete: boolean;
  agentFirst: string;
}) {
  const reduce = useReducedMotion();
  const [moment, setMoment] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    const key = `eos-portal-milestones:${token}`;
    let stored: Stored | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      stored = raw ? (JSON.parse(raw) as Stored) : null;
    } catch {
      stored = null;
    }
    const next: Stored = { stage: stageIndex, docs: docsComplete };
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    if (!stored) return;
    let found: { title: string; body: string } | null = null;
    if (stageIndex > stored.stage) {
      const finished = stageLabels[stageIndex - 1] || "Etap";
      const now = stageLabels[stageIndex];
      found = {
        title: `${finished} — zakończone`,
        body: now ? `Przechodzimy dalej: ${now}. ${agentFirst} prowadzi Cię przez kolejny krok.` : "To był ostatni etap. Gratulacje!",
      };
    } else if (docsComplete && !stored.docs) {
      found = { title: "Komplet dokumentów", body: `${agentFirst} ma wszystko, czego potrzebuje. Dziękujemy!` };
    }
    if (!found) return;
    const show = window.setTimeout(() => setMoment(found), 900);
    const hide = window.setTimeout(() => setMoment(null), 900 + 3800);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
    // Sprawdzamy przy każdej zmianie etapu albo kompletu dokumentów.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, stageIndex, docsComplete]);

  return (
    <AnimatePresence>
      {moment ? (
        <motion.div
          key="milestone"
          className="portal-lux fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setMoment(null)}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="flex w-full max-w-[340px] flex-col items-center rounded-[30px] bg-black px-6 pb-7 pt-8 text-center text-[#F6F3EE] shadow-[0_30px_80px_rgba(0,0,0,0.5)]"
            initial={reduce ? { opacity: 0 } : { scale: 0.86, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <span className="relative flex size-24 items-center justify-center">
              {!reduce ? <span className="eos-seal-rays absolute inset-0 rounded-full" aria-hidden /> : null}
              <motion.span
                className="relative flex size-[74px] items-center justify-center rounded-full bg-[#D8C3A0] text-black shadow-[0_0_0_6px_rgba(216,195,160,0.18)]"
                initial={reduce ? false : { scale: 0.3, rotate: -40 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.12 }}
              >
                <Check className="size-9" strokeWidth={2.6} />
              </motion.span>
            </span>
            <p className="lux-serif mt-5 text-[24px] font-medium leading-tight">{moment.title}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[#BDB6AA]">{moment.body}</p>
            <p className="mt-5 text-[11px] text-[#8C877D]">Dotknij, aby zamknąć</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
