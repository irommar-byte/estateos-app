"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

export type ProgressStage = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
};

/**
 * Pasek kroków ogłoszenia. Jedna reguła dla całego panelu:
 *  • pełne wypełnienie tylko do ostatniego kroku spełnionego PO KOLEI (bez przeskakiwania),
 *  • odcinek do bieżącego kroku „płynie” — trwa,
 *  • dalsze kroki puste.
 */
export function contiguousDone(stages: Array<{ done: boolean }>): number {
  let n = 0;
  for (const s of stages) {
    if (!s.done) break;
    n += 1;
  }
  return n;
}

export default function ListingProgressRail({ stages }: { stages: ProgressStage[] }) {
  const reduce = useReducedMotion();
  if (!stages.length) return null;
  const segments = Math.max(1, stages.length - 1);
  const doneRun = contiguousDone(stages);
  const allDone = doneRun === stages.length;
  // węzeł ostatniego spełnionego kroku (0 = pierwszy); -1 = nic jeszcze nie spełnione
  const lastDoneNode = doneRun - 1;
  const fillPct = lastDoneNode <= 0 ? 0 : (lastDoneNode / segments) * 100;
  const flowFrom = Math.max(0, lastDoneNode);
  const flowPct = allDone ? 0 : (1 / segments) * 100;
  const inset = `${50 / stages.length}%`;
  const track = `(100% - ${inset} - ${inset})`;

  return (
    <div className="relative mt-5" aria-label={`Spełnione kroki: ${doneRun} z ${stages.length}`}>
      <div
        className="absolute top-[11px] h-[3px] rounded-full bg-[var(--lux-line)]"
        style={{ left: inset, right: inset }}
        aria-hidden
      />
      <motion.div
        className="absolute top-[11px] h-[3px] origin-left rounded-full bg-[var(--lux-good)]"
        style={{ left: inset, width: `calc(${track} * ${fillPct / 100})` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
        aria-hidden
      />
      {!allDone && doneRun > 0 ? (
        <div
          className="eos-rail-flow absolute top-[11px] h-[3px] rounded-full"
          style={{ left: `calc(${inset} + ${track} * ${(flowFrom / segments)})`, width: `calc(${track} * ${flowPct / 100})` }}
          aria-hidden
        />
      ) : null}
      <ol className="relative z-10 flex">
        {stages.map((stage, index) => {
          const done = index < doneRun;
          const current = !done && index === doneRun;
          return (
            <li key={stage.id} className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
              {current ? (
                <span className="eos-stage-wave flex size-6 items-center justify-center rounded-full" aria-current="step">
                  <span className="eos-stage-wave__core flex size-6 items-center justify-center rounded-full border-2 border-[var(--lux-good)] bg-[var(--lux-card)]">
                    <span className="size-2 rounded-full bg-[var(--lux-good)]" />
                  </span>
                </span>
              ) : (
                <motion.span
                  initial={reduce || !done ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 20, delay: 0.15 + index * 0.12 }}
                  className={`flex size-6 items-center justify-center rounded-full border ${
                    done
                      ? "border-[var(--lux-good)] bg-[var(--lux-good)] text-white"
                      : "border-[var(--lux-line-strong)] bg-[var(--lux-card)] text-[var(--lux-ink-3)]"
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </motion.span>
              )}
              <span
                className={`mt-2 text-[11px] leading-tight sm:text-[12px] ${
                  done ? "font-bold text-[var(--lux-good)]" : current ? "font-bold text-[var(--lux-ink)]" : "font-medium text-[var(--lux-ink-3)]"
                }`}
              >
                {stage.label}
              </span>
              {current ? <span className="mt-0.5 text-[10.5px] font-semibold text-[var(--lux-ink-3)]">w trakcie</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
