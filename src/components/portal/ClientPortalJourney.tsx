"use client";

import { CheckCircle2 } from "lucide-react";

export type PortalJourneyStage = {
  id: string;
  label: string;
  done: boolean;
  current: boolean;
  hint?: string;
  at?: string | null;
};

export default function ClientPortalJourney({ stages }: { stages: PortalJourneyStage[] }) {
  if (!stages.length) return null;
  const current = stages.find((stage) => stage.current) || stages[stages.length - 1];
  const doneCount = stages.filter((stage) => stage.done).length;

  return (
    <section className="eos-inset-frame eos-stack-card rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eos-portal-label eos-portal-label--ok">Twoja ścieżka</p>
          <h2 className="mt-1 text-xl font-black text-[var(--eos-text)]">Prowadzimy Cię krok po kroku</h2>
        </div>
        <p className="text-xs font-semibold text-[var(--eos-muted)]">
          {doneCount}/{stages.length} etapów · {current.label}
        </p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={`rounded-2xl px-3 py-3 transition ${
              stage.done
                ? "eos-inset-well border-emerald-500/35 bg-emerald-500/10"
                : stage.current
                  ? "eos-lux-panel border-emerald-500/60"
                  : "eos-inset-well opacity-80"
            }`}
          >
            <p className="eos-portal-label">
              {stage.done ? "Gotowe" : stage.current ? `Teraz · ${index + 1}` : `Dalej · ${index + 1}`}
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-[var(--eos-text)]">{stage.label}</p>
            {stage.at ? (
              <p className="mt-1 text-[11px] text-[var(--eos-muted)]">
                {new Date(stage.at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {current?.hint ? (
        <div className="eos-inset-well mt-5 rounded-2xl px-4 py-4">
          <p className="eos-portal-label eos-portal-label--ok flex items-center gap-2">
            <CheckCircle2 className="size-3.5" />
            Co teraz
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--eos-text)]">{current.hint}</p>
        </div>
      ) : null}
    </section>
  );
}
