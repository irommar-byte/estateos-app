import { Check, Minus, X } from "lucide-react";

export type MatchReason = { tone: "good" | "warn" | "bad"; label: string };

const TONE: Record<MatchReason["tone"], { cls: string; Icon: typeof Check }> = {
  good: { cls: "eos-reason eos-reason--good", Icon: Check },
  warn: { cls: "eos-reason eos-reason--warn", Icon: Minus },
  bad: { cls: "eos-reason eos-reason--bad", Icon: X },
};

/** Powody dopasowania — ten sam silnik dla klienta, agenta i radaru. */
export default function MatchReasonChips({
  reasons,
  max,
  className = "",
}: {
  reasons: MatchReason[];
  max?: number;
  className?: string;
}) {
  const list = typeof max === "number" ? reasons.slice(0, max) : reasons;
  if (!list.length) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Dlaczego ta oferta">
      {list.map((r, i) => {
        const { cls, Icon } = TONE[r.tone] || TONE.good;
        return (
          <li key={`${r.label}-${i}`} className={cls}>
            <Icon className="size-3 shrink-0" strokeWidth={2.6} aria-hidden />
            <span>{r.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
