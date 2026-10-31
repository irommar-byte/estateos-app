"use client";

import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePortalLocale } from "@/components/portal/PortalLocale";

export type LuxAxisStage = {
  id: string;
  label: string;
  summary?: React.ReactNode;
  state: "done" | "current" | "future";
  content?: React.ReactNode;
};

export type PortalFact = {
  key: string;
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  hint?: React.ReactNode;
};

/**
 * Przegląd współpracy w jednym miejscu: na którym etapie jesteśmy, co już za nami (z wynikiem),
 * co dalej — oraz co, gdzie, z kim, za ile i kiedy. Pod spodem tylko to, co trzeba zrobić teraz.
 */
export default function PortalOverview({
  title,
  stages,
  facts,
  action,
}: {
  title: string;
  stages: LuxAxisStage[];
  facts: PortalFact[];
  action?: React.ReactNode;
}) {
  const { t } = usePortalLocale();
  const currentIndex = Math.max(0, stages.findIndex((s) => s.state === "current"));
  const allDone = stages.every((s) => s.state === "done");
  const current = allDone ? null : stages[currentIndex];

  return (
    <section id="grp-journey" data-group="journey" className="portal-overview scroll-mt-24">
      <span id="portal-journey" className="block scroll-mt-24" aria-hidden />
      <div className="flex items-baseline justify-between gap-3">
        <p className="lux-kicker">{title}</p>
        <p className="text-[12px] font-semibold text-[var(--lux-ink-3)]">
          {allDone ? t("Zakończone") : t("Etap {n} z {total}", { n: currentIndex + 1, total: stages.length })}
        </p>
      </div>

      <ol className="portal-overview__steps" style={{ ["--steps" as string]: stages.length }}>
        {stages.map((stage, index) => (
          <li key={stage.id} className="portal-overview__step" data-state={stage.state}>
            <span className="portal-overview__dot" aria-hidden>
              {stage.state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className="portal-overview__text">
              <span className="portal-overview__label">{stage.label}</span>
              {stage.state === "current" ? <span className="portal-overview__now">{t("Teraz")}</span> : null}
              {stage.summary && stage.state !== "future" ? <span className="portal-overview__summary">{stage.summary}</span> : null}
            </span>
          </li>
        ))}
      </ol>

      {facts.length ? (
        <dl className="portal-overview__facts">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.key} className="portal-overview__fact">
                <dt>
                  <Icon className="size-3.5" aria-hidden />
                  {fact.label}
                </dt>
                <dd>{fact.value}</dd>
                {fact.hint ? <dd className="portal-overview__hint">{fact.hint}</dd> : null}
              </div>
            );
          })}
        </dl>
      ) : null}

      {action ? (
        <div className="portal-overview__action">
          {current ? <p className="lux-kicker">{t("Teraz · {stage}", { stage: current.label })}</p> : null}
          <div className="mt-3 space-y-3">{action}</div>
        </div>
      ) : null}
    </section>
  );
}
