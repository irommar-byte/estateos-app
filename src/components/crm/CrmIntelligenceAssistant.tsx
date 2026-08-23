"use client";

import { useEffect, useState } from "react";
import type { IntelligenceChoice, IntelligenceSettings } from "@/lib/crm/clientIntelligence";
import {
  DEFAULT_INTELLIGENCE_SETTINGS,
  INTELLIGENCE_DAILY_LIMIT_OPTIONS,
  INTELLIGENCE_INTERVAL_OPTIONS,
  INTELLIGENCE_MIN_LEARNS_OPTIONS,
  INTELLIGENCE_MIN_SCORE_OPTIONS,
} from "@/lib/crm/clientIntelligence";
import type { IntelligencePick } from "@/lib/crm/clientIntelligenceRun";
import { eosBtn } from "@/components/ui/eosButtonStyles";

const BUBBLES = [
  { color: "#ff4d6d", size: 118, x: "8%", y: "72%", delay: "0s", duration: "11s" },
  { color: "#ffd166", size: 86, x: "78%", y: "8%", delay: "1.2s", duration: "13s" },
  { color: "#06d6a0", size: 96, x: "62%", y: "68%", delay: "0.4s", duration: "10s" },
  { color: "#4cc9f0", size: 74, x: "18%", y: "12%", delay: "2s", duration: "14s" },
  { color: "#c77dff", size: 108, x: "88%", y: "48%", delay: "0.8s", duration: "12s" },
  { color: "#ff9f1c", size: 64, x: "42%", y: "82%", delay: "1.6s", duration: "9s" },
  { color: "#80ffdb", size: 52, x: "52%", y: "18%", delay: "2.4s", duration: "15s" },
  { color: "#ff70a6", size: 70, x: "4%", y: "42%", delay: "0.6s", duration: "11s" },
];

function IosRainbowSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || "Włącz tęczowego asystenta"}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`eos-intel-switch ${checked ? "is-on" : ""} ${disabled ? "opacity-50" : ""}`}
    >
      {checked ? (
        <span className="eos-intel-switch__orbs" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      ) : null}
      <span className="eos-intel-switch__knob" />
    </button>
  );
}

function ChoiceRow({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  options: IntelligenceChoice[];
  onChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-[var(--eos-muted)]">{label}</p>
      {hint ? <p className="text-[11px] leading-snug text-[var(--eos-text)]/65">{hint}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${
                active
                  ? "border-emerald-400 bg-emerald-400 text-black"
                  : "border-white/15 bg-black/20 text-[var(--eos-text)]/80 hover:border-white/35"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function CrmIntelligenceAssistant({
  clientId,
  value,
  busy,
  onSave,
}: {
  clientId: number;
  value?: IntelligenceSettings | null;
  busy?: boolean;
  onSave: (next: IntelligenceSettings) => void;
}) {
  const [draft, setDraft] = useState<IntelligenceSettings>(value || DEFAULT_INTELLIGENCE_SETTINGS);
  const [pick, setPick] = useState<IntelligencePick | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [smartAdd, setSmartAdd] = useState(false);
  const [smartAddBusy, setSmartAddBusy] = useState(false);

  useEffect(() => {
    setDraft(value || DEFAULT_INTELLIGENCE_SETTINGS);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/crm/intelligence-smart-add", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && typeof json?.enabled === "boolean") setSmartAdd(json.enabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSmartAdd = async (enabled: boolean) => {
    setSmartAddBusy(true);
    setSmartAdd(enabled);
    try {
      const res = await fetch("/api/crm/intelligence-smart-add", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) setSmartAdd(!enabled);
      else if (typeof json.enabled === "boolean") setSmartAdd(json.enabled);
    } catch {
      setSmartAdd(!enabled);
    } finally {
      setSmartAddBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setQueueBusy(true);
    fetch(`/api/crm/clients/${clientId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "intelligence_preview" }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json?.pick) setPick(json.pick as IntelligencePick);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setQueueBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, value?.lastSentAt, value?.enabled, value?.minScore, value?.minLearns, value?.intervalHours]);

  const nextWhen = pick?.nextSendAt
    ? new Date(pick.nextSendAt).toLocaleString("pl-PL", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={`eos-intel-shell ${draft.enabled ? "is-on" : ""}`}>
      <div className="eos-intel-bubbles" aria-hidden>
        {BUBBLES.map((bubble) => (
          <span
            key={`${bubble.color}-${bubble.x}`}
            className="eos-intel-bubble"
            style={{
              background: bubble.color,
              width: bubble.size,
              height: bubble.size,
              left: bubble.x,
              top: bubble.y,
              animationDelay: bubble.delay,
              animationDuration: bubble.duration,
            }}
          />
        ))}
      </div>
      <div className="relative z-[1] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="eos-intel-kicker text-[10px] font-black uppercase tracking-[0.16em]">
              Tęczowy asystent · EstateOS™ Intelligence
            </p>
            <p className="mt-1 text-sm text-[var(--eos-text)]/80">
              Uczy się z reakcji klienta (oglądać / przemyśleć / odłóż + obiekcje) i po kilku próbach sam wysyła
              jedną pewną propozycję w Twoim imieniu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--eos-text)]">
              {draft.enabled ? "Włączony" : "Wyłączony"}
            </span>
            <IosRainbowSwitch
              checked={draft.enabled}
              disabled={busy}
              onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--eos-text)]">
              Inteligentne dodawanie
            </p>
            <p className="mt-1 text-xs leading-snug text-[var(--eos-text)]/75">
              Przy imporcie mózg pyta, czy zaznaczyć balkon, komórkę, ogród i resztę z opisu. Każdą zmianę widać na
              ofercie i można cofnąć.
            </p>
          </div>
            <IosRainbowSwitch
            checked={smartAdd}
            disabled={smartAddBusy}
            label="Inteligentne dodawanie"
            onChange={(enabled) => void saveSmartAdd(enabled)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceRow
            label="Interwał"
            hint="Jak często asystent wraca do kolejki."
            value={draft.intervalHours}
            options={INTELLIGENCE_INTERVAL_OPTIONS}
            onChange={(intervalHours) => setDraft((current) => ({ ...current, intervalHours }))}
          />
          <ChoiceRow
            label="Ofert na cykl"
            hint="Ile ogłoszeń może wysłać za jednym razem, gdy interwał minie."
            value={draft.dailyLimit}
            options={INTELLIGENCE_DAILY_LIMIT_OPTIONS}
            onChange={(dailyLimit) => setDraft((current) => ({ ...current, dailyLimit }))}
          />
          <ChoiceRow
            label="Ile reakcji zanim wyśle"
            hint="Przy braku reakcji asystent i tak wyśle pakiet kalibracyjny z radaru."
            value={draft.minLearns}
            options={INTELLIGENCE_MIN_LEARNS_OPTIONS}
            onChange={(minLearns) => setDraft((current) => ({ ...current, minLearns }))}
          />
          <ChoiceRow
            label="Minimalna pewność"
            hint="Próg wysyłki po ankiecie i nauce. Mózg tylko koryguje wynik — ten próg nadal odcina słabe trafienia."
            value={draft.minScore}
            options={INTELLIGENCE_MIN_SCORE_OPTIONS}
            onChange={(minScore) => setDraft((current) => ({ ...current, minScore }))}
          />
        </div>

        <div className="eos-intel-queue rounded-2xl p-3">
          <p className="eos-intel-kicker text-[10px] font-black uppercase tracking-[0.14em]">Następne w kolejce</p>
          {queueBusy ? (
            <p className="mt-2 text-sm text-[var(--eos-muted)]">Analizuję opisy i reakcje…</p>
          ) : pick?.offerId ? (
            <>
              <p className="mt-1 text-sm font-black text-[var(--eos-text)]">{pick.title}</p>
              <p className="mt-0.5 text-xs font-semibold text-[var(--eos-text)]/75">
                {[pick.city, pick.district].filter(Boolean).join(" · ")}
                {pick.price ? ` · ${Math.round(pick.price).toLocaleString("pl-PL")} zł` : ""}
                {pick.area ? ` · ${pick.area} m²` : ""}
                {pick.score != null ? ` · pewność ${pick.score}%` : ""}
              </p>
              <p className="mt-2 text-sm text-[var(--eos-text)]">
                {pick.ready
                  ? `${pick.calibrating ? "Kalibracja · " : ""}Wyślę przy najbliższym cyklu${nextWhen ? ` · ${nextWhen}` : " (co godzinę)."}`
                  : pick.skipReason
                    ? `${pick.skipReason}${nextWhen ? ` Planowana wysyłka: ${nextWhen}.` : ""}`
                    : nextWhen
                      ? `Planowana wysyłka: ${nextWhen}.`
                      : "Czeka na włączenie albo kolejne reakcje."}
              </p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">
                Dlaczego akurat to
              </p>
              <ul className="mt-1 space-y-1 text-[13px] leading-snug text-[var(--eos-text)]/90">
                {(pick.analysis?.length ? pick.analysis : pick.reasons).map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-[var(--eos-muted)]">
              {pick?.skipReason || "Brak jeszcze kandydata. Potrzeba reakcji klienta albo niewysłanych trafień radaru."}
            </p>
          )}
          {draft.lastSentAt ? (
            <p className="mt-3 text-[11px] text-[var(--eos-muted)]">
              Ostatni domysł: {new Date(draft.lastSentAt).toLocaleString("pl-PL")}
            </p>
          ) : null}
        </div>

        <button type="button" disabled={busy} onClick={() => onSave(draft)} className={eosBtn("home", { size: "sm" })}>
          {busy ? "Zapisuję…" : "Zapisz asystenta"}
        </button>
      </div>
    </div>
  );
}
