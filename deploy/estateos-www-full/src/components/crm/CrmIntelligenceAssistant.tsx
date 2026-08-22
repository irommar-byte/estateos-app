"use client";

import { useEffect, useState } from "react";
import type { IntelligenceSettings } from "@/lib/crm/clientIntelligence";
import { DEFAULT_INTELLIGENCE_SETTINGS } from "@/lib/crm/clientIntelligence";

export default function CrmIntelligenceAssistant({
  value,
  busy,
  onSave,
}: {
  value?: IntelligenceSettings | null;
  busy?: boolean;
  onSave: (next: IntelligenceSettings) => void;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  useEffect(() => {
    setDraft(value || DEFAULT_INTELLIGENCE_SETTINGS);
  }, [value]);

  return (
    <div className="eos-intel-frame space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eos-intel-kicker text-[10px] font-black uppercase tracking-[0.16em]">
            Tęczowy asystent · EstateOS™ Intelligence
          </p>
          <p className="mt-1 text-sm text-[var(--eos-muted)]">
            Uczy się z reakcji klienta (oglądać / przemyśleć / odłóż + obiekcje) i po kilku próbach sam wysyła
            jedną pewną propozycję w Twoim imieniu.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
            className="size-4 accent-emerald-500"
          />
          Włącz
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-[var(--eos-muted)]">
          Interwał (godziny)
          <input
            type="number"
            min={6}
            max={168}
            value={draft.intervalHours}
            onChange={(event) => setDraft((current) => ({ ...current, intervalHours: Number(event.target.value) || 24 }))}
            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
          />
        </label>
        <label className="text-xs font-bold text-[var(--eos-muted)]">
          Ofert na cykl
          <input
            type="number"
            min={1}
            max={3}
            value={draft.dailyLimit}
            onChange={(event) => setDraft((current) => ({ ...current, dailyLimit: Number(event.target.value) || 1 }))}
            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
          />
        </label>
        <label className="text-xs font-bold text-[var(--eos-muted)]">
          Ile reakcji zanim wyśle
          <input
            type="number"
            min={1}
            max={12}
            value={draft.minLearns}
            onChange={(event) => setDraft((current) => ({ ...current, minLearns: Number(event.target.value) || 3 }))}
            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
          />
        </label>
        <label className="text-xs font-bold text-[var(--eos-muted)]">
          Minimalna pewność (%)
          <input
            type="number"
            min={70}
            max={100}
            value={draft.minScore}
            onChange={(event) => setDraft((current) => ({ ...current, minScore: Number(event.target.value) || 92 }))}
            className="mt-1 w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2 text-sm text-[var(--eos-text)]"
          />
        </label>
      </div>
      {draft.lastSentAt ? (
        <p className="text-[11px] text-[var(--eos-muted)]">
          Ostatni domysł: {new Date(draft.lastSentAt).toLocaleString("pl-PL")}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(draft)}
        className="rounded-full bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-50"
      >
        Zapisz asystenta
      </button>
    </div>
  );
}
