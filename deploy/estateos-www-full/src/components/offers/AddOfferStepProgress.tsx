"use client";

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
 * Pasek postępu jak w aplikacji (AddOfferStepper): równe łączniki + wypełnienie ciągłe.
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
  const fillPct = Math.max(0, Math.min(100, ((currentStep - 1) / Math.max(1, totalSteps - 1)) * 100));

  return (
    <div className="sticky top-[calc(var(--eos-nav-height)+0.5rem)] z-40 mb-8 rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)]/95 px-4 py-4 shadow-[var(--eos-shadow-soft)] backdrop-blur-2xl md:px-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--eos-muted)]">
          {stepLabel} {currentStep} {stepOf} {totalSteps}
        </span>
        <span
          className={`text-[10px] font-black uppercase tracking-[0.14em] ${
            canAdvanceCurrent ? "text-emerald-500" : "text-amber-500"
          }`}
        >
          {canAdvanceCurrent ? canProceedHint : completeStepHint}
        </span>
      </div>

      {/* Ciągły track */}
      <div className="relative mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--eos-border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500 ease-out"
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Kropki + równe łączniki */}
      <div className="flex w-full items-center">
        {items.map((item, index) => {
          const active = currentStep === item.step;
          const done = isStepDone(item.step) || item.step < currentStep;
          const needsFix = stepNeedsFix(item.step);
          const connectorFilled = item.step < currentStep || (item.step === currentStep && canAdvanceCurrent);

          return (
            <div key={item.step} className={`flex items-center ${index < items.length - 1 ? "flex-1" : ""}`}>
              <button
                type="button"
                onClick={() => onSelectStep(item.step)}
                title={item.label}
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-black transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-500 text-black shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                    : needsFix
                      ? "border-red-500/60 bg-red-500/15 text-red-500"
                      : done
                        ? "border-emerald-500/50 bg-emerald-500 text-black"
                        : "border-[var(--eos-border)] bg-[var(--eos-input)] text-[var(--eos-muted)]"
                }`}
              >
                {done && !active && !needsFix ? "✓" : item.step}
              </button>
              {index < items.length - 1 ? (
                <div className="mx-2 h-[3px] min-w-[12px] flex-1 rounded-full bg-[var(--eos-border)]">
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

      <p className="mt-3 text-center text-[11px] font-semibold text-[var(--eos-text)]">
        {items.find((i) => i.step === currentStep)?.label || ""}
      </p>
    </div>
  );
}
