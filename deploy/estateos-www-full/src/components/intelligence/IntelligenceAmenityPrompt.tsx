"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntelligenceAmenityField, IntelligenceAmenitySuggestion } from "@/lib/intelligenceAmenityBrain";
import { playIntelligenceChime } from "@/lib/discovery/intelligenceChime";
import IntelligenceOilBrain from "@/components/intelligence/IntelligenceOilBrain";

export type SmartAddDecisions = Partial<Record<IntelligenceAmenityField, boolean>>;

export default function IntelligenceAmenityPrompt({
  suggestions,
  onDone,
}: {
  suggestions: IntelligenceAmenitySuggestion[];
  onDone: (decisions: SmartAddDecisions) => void;
}) {
  const queue = useMemo(() => suggestions.filter((item) => item.field), [suggestions]);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<SmartAddDecisions>({});
  const [thanks, setThanks] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!queue.length) onDone({});
  }, [onDone, queue.length]);

  const current = queue[index];
  if (!current) return null;

  const finish = (next: SmartAddDecisions) => {
    onDone(next);
  };

  const answer = (yes: boolean) => {
    const next = { ...decisions, [current.field]: yes };
    setDecisions(next);
    if (yes) {
      setThanks(true);
      void playIntelligenceChime("bingo");
      window.setTimeout(() => {
        setThanks(false);
        if (index + 1 >= queue.length) finish(next);
        else setIndex((value) => value + 1);
      }, 1100);
      return;
    }
    if (index + 1 >= queue.length) finish(next);
    else setIndex((value) => value + 1);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="eos-intel-shell is-on relative w-full max-w-md overflow-hidden rounded-[28px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="relative z-[1] flex flex-col items-center text-center">
          <IntelligenceOilBrain size={72} celebrating={thanks} reduceMotion={reduceMotion} />
          <p className="eos-intel-kicker mt-4 text-[10px] font-black uppercase tracking-[0.16em]">
            EstateOS™ Intelligence · Inteligentne dodawanie
          </p>
          {thanks ? (
            <p className="mt-3 text-lg font-black text-[var(--eos-text)]">Dziękuję. Bingo — naprawione.</p>
          ) : (
            <>
              <p className="mt-3 text-lg font-black leading-snug text-[var(--eos-text)]">{current.question}</p>
              {current.quotes.length ? (
                <div className="mt-3 w-full space-y-2">
                  {current.quotes.map((quote) => (
                    <p
                      key={quote}
                      className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-left text-sm leading-snug text-[var(--eos-text)]/90"
                    >
                      „{quote}”
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--eos-muted)]">Na podstawie całego opisu ogłoszenia.</p>
              )}
              <p className="mt-2 text-[11px] text-[var(--eos-muted)]">
                {index + 1} / {queue.length} · {current.label}
              </p>
              <div className="mt-5 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-3 text-sm font-black uppercase tracking-wider text-[var(--eos-text)]"
                >
                  Nie
                </button>
                <button
                  type="button"
                  onClick={() => answer(true)}
                  className="flex-1 rounded-full bg-white px-4 py-3 text-sm font-black uppercase tracking-wider text-black"
                >
                  Tak
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
