"use client";

import { Check } from "lucide-react";

export type LuxAxisStage = {
  id: string;
  label: string;
  summary?: React.ReactNode;
  state: "done" | "current" | "future";
  content?: React.ReactNode;
};

/** Oś „droga do kluczy”: zakończone etapy z krótkim podsumowaniem, bieżący z treścią, przyszłe z zapowiedzią. */
export default function PortalJourneyAxis({ title, stages, hideTitle }: { title: string; stages: LuxAxisStage[]; hideTitle?: boolean }) {
  return (
    <section aria-label={title}>
      {!hideTitle ? <p className="lux-kicker">{title}</p> : null}
      <ol className={hideTitle ? "mt-1" : "mt-4"}>
        {stages.map((stage, index) => {
          const last = index === stages.length - 1;
          const number = index + 1;
          return (
            <li key={stage.id} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                {stage.state === "done" ? (
                  <span className="flex size-[26px] items-center justify-center rounded-full bg-[var(--lux-accent)] text-[var(--lux-bg)]">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                  </span>
                ) : stage.state === "current" ? (
                  <span className="eos-stage-wave flex size-[26px] items-center justify-center rounded-full" aria-label={`Etap ${number} — w trakcie`}>
                    <span className="eos-stage-wave__core flex size-[26px] items-center justify-center rounded-full bg-black text-xs font-bold text-[#D8C3A0] shadow-[0_0_0_3px_var(--lux-bg),0_0_0_4px_#D8C3A0]">
                      {number}
                    </span>
                  </span>
                ) : (
                  <span className="flex size-[26px] items-center justify-center rounded-full border border-[var(--lux-line)] text-xs font-semibold text-[var(--lux-ink-3)]">
                    {number}
                  </span>
                )}
                {!last ? (
                  <span
                    className={`min-h-[22px] flex-1 ${
                      stage.state === "done"
                        ? "w-px bg-[var(--lux-accent)]"
                        : stage.state === "current"
                          ? "eos-axis-flow w-[2px] rounded-full"
                          : "w-px bg-[var(--lux-line-strong)]"
                    }`}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className={`min-w-0 flex-1 ${last ? "" : stage.state === "current" ? "pb-6" : "pb-4"}`}>
                <p className={`mt-[3px] text-[15px] font-bold ${stage.state === "future" ? "text-[var(--lux-ink-2)]" : "text-[var(--lux-ink)]"}`}>
                  {stage.label}
                </p>
                {stage.summary ? (
                  <div className={`mt-0.5 text-[13px] ${stage.state === "future" ? "text-[var(--lux-ink-3)]" : "text-[var(--lux-ink-2)]"}`}>
                    {stage.summary}
                  </div>
                ) : null}
                {stage.state === "current" && stage.content ? <div className="mt-3 space-y-3">{stage.content}</div> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
