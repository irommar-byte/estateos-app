"use client";

import { Check } from "lucide-react";

type StepItem = {
  step: number;
  label: string;
};

type AddOfferStepProgressProps = {
  currentStep: number;
  totalSteps: number;
  items: StepItem[];
  stepLabel: string;
  stepOf: string;
  canProceedHint: string;
  completeStepHint: string;
  canAdvanceCurrent: boolean;
  isStepDone: (step: number) => boolean;
  stepNeedsFix: (step: number) => boolean;
  onSelectStep: (step: number) => void;
};

/**
 * Premium pasek postępu: track nad kółkami + łączniki między nimi (nigdy przez kółko).
 */
export default function AddOfferStepProgress({
  currentStep,
  totalSteps,
  items,
  stepLabel,
  stepOf,
  canProceedHint,
  completeStepHint,
  canAdvanceCurrent,
  isStepDone,
  stepNeedsFix,
  onSelectStep,
}: AddOfferStepProgressProps) {
  const doneCount = items.filter((item) => isStepDone(item.step) || item.step < currentStep).length;
  const hasBlockers = items.some((item) => stepNeedsFix(item.step));
  const fillPct = Math.max(
    0,
    Math.min(100, hasBlockers ? (doneCount / Math.max(1, totalSteps)) * 100 : ((currentStep - 1) / Math.max(1, totalSteps - 1)) * 100),
  );
  const percentLabel = hasBlockers
    ? Math.round((doneCount / Math.max(1, totalSteps)) * 100)
    : Math.round((currentStep / Math.max(1, totalSteps)) * 100);
  const statusOk = canAdvanceCurrent && !hasBlockers;

  return (
    <div className="sticky top-[calc(var(--eos-nav-height)+0.5rem)] z-40 mb-8 overflow-hidden rounded-[1.85rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/95 shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative px-4 py-5 sm:px-6 sm:py-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--eos-muted)]">
              {stepLabel} {currentStep} {stepOf} {totalSteps}
            </p>
            <p className="mt-1 text-sm font-bold tracking-tight text-[var(--eos-text)] sm:text-base">
              {items.find((i) => i.step === currentStep)?.label || ""}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-2xl font-black tabular-nums tracking-tight sm:text-3xl ${
                hasBlockers ? "text-amber-500" : "text-emerald-500"
              }`}
            >
              {percentLabel}
              <span className={`text-sm font-bold ${hasBlockers ? "text-amber-500/70" : "text-emerald-500/70"}`}>
                %
              </span>
            </p>
            <p
              className={`mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                statusOk ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {statusOk ? canProceedHint : completeStepHint}
            </p>
          </div>
        </div>

        {/* Ciągły pasek NAD kółkami — nie przechodzi przez nie */}
        <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--eos-border)]">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ease-out ${
              hasBlockers
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
            }`}
            style={{ width: `${fillPct}%` }}
          />
        </div>

        <div className="flex w-full items-start">
          {items.map((item, index) => {
            const active = currentStep === item.step;
            const done = (isStepDone(item.step) || item.step < currentStep) && !active;
            const needsFix = stepNeedsFix(item.step);
            const connectorFilled = item.step < currentStep;

            return (
              <div key={item.step} className={`flex items-start ${index < items.length - 1 ? "min-w-0 flex-1" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSelectStep(item.step)}
                  className="group flex w-[4.5rem] shrink-0 flex-col items-center gap-2 text-center transition-transform active:scale-[0.98] sm:w-[5.25rem]"
                >
                  <span
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-[12px] font-black transition-all duration-300 sm:h-10 sm:w-10 sm:text-[13px] ${
                      active
                        ? "border-emerald-400 bg-emerald-500 text-black shadow-[0_0_0_4px_rgba(16,185,129,0.16),0_8px_22px_rgba(16,185,129,0.3)] scale-110"
                        : needsFix
                          ? "border-red-500 bg-[var(--eos-card)] text-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.14)]"
                          : done
                            ? "border-emerald-500 bg-emerald-500 text-black shadow-[0_4px_14px_rgba(16,185,129,0.22)]"
                            : "border-[var(--eos-border-strong)] bg-[var(--eos-card)] text-[var(--eos-muted)] group-hover:border-emerald-500/45 group-hover:text-[var(--eos-text)]"
                    }`}
                  >
                    {done && !needsFix ? <Check className="h-4 w-4" strokeWidth={3} /> : item.step}
                  </span>

                  <span className="flex min-h-[2.75rem] flex-col items-center justify-start gap-0.5 px-0.5">
                    <span
                      className={`text-[9px] font-black uppercase leading-tight tracking-[0.06em] sm:text-[10px] sm:tracking-[0.08em] ${
                        active
                          ? "text-emerald-500"
                          : needsFix
                            ? "text-red-500"
                            : done
                              ? "text-[var(--eos-text)]"
                              : "text-[var(--eos-muted)]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {needsFix ? (
                      <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-red-500">!</span>
                    ) : done ? (
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
                        OK
                      </span>
                    ) : active ? (
                      <span className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-transparent" />
                    )}
                  </span>
                </button>

                {index < items.length - 1 ? (
                  <div className="mt-[17px] mx-1 h-[3px] min-w-[8px] flex-1 rounded-full bg-[var(--eos-border)] sm:mt-[18px] sm:mx-2">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        connectorFilled ? "w-full bg-emerald-500" : "w-0 bg-transparent"
                      }`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
