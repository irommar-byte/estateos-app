"use client";

import { Check } from "lucide-react";

export type PortalJourneyStage = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
  at?: string | null;
};

export default function ClientPortalJourney({
  stages,
  clientType,
}: {
  stages: PortalJourneyStage[];
  clientType?: "BUYER" | "SELLER";
}) {
  if (!stages.length) return null;
  const current = stages.find((stage) => stage.current) || stages[stages.length - 1];
  const doneCount = stages.filter((stage) => stage.done).length;
  const segments = Math.max(1, stages.length - 1);
  const reached = stages.every((s) => s.done) ? stages.length - 1 : doneCount;
  const fillPct = (reached / segments) * 100;
  const inset = `${50 / stages.length}%`;
  const kicker = clientType === "BUYER" ? "Proces zakupu" : "Proces sprzedaży";

  return (
    <section className="eos-inset-frame rounded-[1.75rem] p-5 sm:p-6 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eos-portal-label eos-portal-label--ok">{kicker}</p>
          <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">{current.label}</h2>
        </div>
        <p className="text-xs font-semibold text-[var(--eos-muted)]">
          {doneCount}/{stages.length} etapów
        </p>
      </div>

      <div className="relative mt-6">
        <div
          className="absolute top-[11px] h-[4px] rounded-full bg-[rgba(15,23,42,0.08)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.18)]"
          style={{ left: inset, right: inset }}
          aria-hidden
        />
        <div
          className="absolute top-[11px] h-[4px] rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.55)]"
          style={{ left: inset, width: `calc((100% - ${inset} - ${inset}) * ${fillPct / 100})` }}
          aria-hidden
        />
        <ol className="relative z-10 flex">
          {stages.map((stage) => (
            <li key={stage.id} className="flex min-w-0 flex-1 flex-col items-center px-0.5 text-center">
              <span
                className={`flex size-6 items-center justify-center rounded-full border text-[10px] font-black shadow-[0_6px_14px_rgba(15,23,42,0.16)] ${
                  stage.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : stage.current
                      ? "border-emerald-300 bg-emerald-700 text-white ring-4 ring-emerald-500/15"
                      : "border-[var(--eos-border)] bg-[var(--eos-card)] text-[var(--eos-muted)]"
                }`}
              >
                {stage.done ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span
                className={`mt-2 text-[10px] font-extrabold leading-tight sm:text-[11px] ${
                  stage.done || stage.current ? "text-[var(--eos-text)]" : "text-[var(--eos-muted)]"
                }`}
              >
                {stage.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {current?.hint ? (
        <p className="mt-5 text-sm leading-relaxed text-[var(--eos-muted)]">{current.hint}</p>
      ) : null}
    </section>
  );
}
