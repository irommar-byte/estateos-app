"use client";

import { useEffect, useRef, useState } from "react";
import { FileSearch, ShieldCheck } from "lucide-react";
import { formatPolishDateInput, isCompletePolishDate } from "@/utils/polishDateInput";

export type CarVehicleDocsFormState = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  insuranceValidUntil: string;
};

type CarVehicleDocsFieldsProps = {
  value: CarVehicleDocsFormState;
  onChange: (patch: Partial<CarVehicleDocsFormState>) => void;
};

function isValidVinQuick(vin: string) {
  const normalized = vin.trim().toUpperCase();
  return normalized.length === 17 && !/[IOQ]/.test(normalized);
}

export default function CarVehicleDocsFields({ value, onChange }: CarVehicleDocsFieldsProps) {
  const [historyLoading, setHistoryLoading] = useState(false);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const [historyReport, setHistoryReport] = useState<{
    summary: string;
    sections: { title: string; rows: { label: string; value: string }[] }[];
  } | null>(null);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [insuranceOk, setInsuranceOk] = useState<boolean | null>(null);
  const autoCheckSeq = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const canVerify = Boolean(
    isValidVinQuick(value.vin) && value.registrationNumber.trim() && isCompletePolishDate(value.firstRegistrationDate),
  );

  useEffect(() => {
    if (!canVerify) return;
    const seq = ++autoCheckSeq.current;
    const timer = setTimeout(() => {
      setAutoChecking(true);
      fetch("/api/cars/insurance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Błąd sprawdzania OC.");
          return data;
        })
        .then((data) => {
          if (seq !== autoCheckSeq.current) return;
          setInsuranceOk(Boolean(data.hasInsurance));
          setInsuranceMessage(String(data.message || ""));
          if (data.validUntil && data.validUntil !== value.insuranceValidUntil) {
            onChangeRef.current({ insuranceValidUntil: String(data.validUntil) });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (seq === autoCheckSeq.current) setAutoChecking(false);
        });
    }, 900);
    return () => clearTimeout(timer);
  }, [canVerify, value.vin, value.registrationNumber, value.firstRegistrationDate, value.insuranceValidUntil]);

  const handleHistory = async () => {
    if (!canVerify) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/cars/vehicle-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się pobrać historii.");
      }
      setHistoryReport(data.report);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd sprawdzania historii.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInsurance = async () => {
    if (!canVerify) return;
    setInsuranceLoading(true);
    try {
      const response = await fetch("/api/cars/insurance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się sprawdzić ubezpieczenia.");
      }
      setInsuranceOk(Boolean(data.hasInsurance));
      setInsuranceMessage(String(data.message || ""));
      if (data.validUntil) onChange({ insuranceValidUntil: String(data.validUntil) });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd sprawdzania ubezpieczenia.");
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-sky-400/20 bg-sky-950/15 p-4">
      <div>
        <p className="text-sm font-semibold text-sky-300">Dokumenty pojazdu</p>
        <p className="mt-1 text-xs text-[var(--eos-muted)]">VIN, rejestracja i weryfikacja CEPIK/UFG.</p>
      </div>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Numer VIN</span>
        <input
          value={value.vin}
          onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="17 znaków"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Numer rejestracyjny</span>
        <input
          value={value.registrationNumber}
          onChange={(e) => onChange({ registrationNumber: e.target.value.toUpperCase() })}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="np. WH 9737A"
        />
      </label>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Data pierwszej rejestracji</span>
        <input
          value={value.firstRegistrationDate}
          onChange={(e) => onChange({ firstRegistrationDate: formatPolishDateInput(e.target.value) })}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="DD.MM.RRRR"
          inputMode="numeric"
        />
      </label>

      <button
        type="button"
        onClick={() => void handleHistory()}
        disabled={historyLoading || !canVerify}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/35 bg-sky-900/25 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-sky-200 disabled:opacity-45"
      >
        <FileSearch className="size-4" />
        {historyLoading ? "Sprawdzanie..." : "Sprawdź historię pojazdu"}
      </button>

      <label className="grid gap-1.5 text-sm">
        <span className="text-[var(--eos-muted)]">Ważność polisy OC</span>
        <input
          value={value.insuranceValidUntil}
          onChange={(e) => onChange({ insuranceValidUntil: formatPolishDateInput(e.target.value) })}
          className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3 py-2 outline-none focus:border-sky-400/50"
          placeholder="DD.MM.RRRR"
          inputMode="numeric"
        />
      </label>

      {autoChecking ? <p className="text-xs text-[var(--eos-muted)]">Sprawdzam OC w CEPIK/UFG...</p> : null}

      <button
        type="button"
        onClick={() => void handleInsurance()}
        disabled={insuranceLoading || !canVerify}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-900/20 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-200 disabled:opacity-45"
      >
        <ShieldCheck className="size-4" />
        {insuranceLoading ? "Sprawdzanie..." : "Sprawdź ubezpieczenie"}
      </button>

      {insuranceMessage ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            insuranceOk
              ? "border-emerald-400/30 bg-emerald-900/15 text-emerald-100"
              : "border-amber-400/30 bg-amber-950/20 text-amber-100"
          }`}
        >
          {insuranceMessage}
        </p>
      ) : null}

      {historyReport ? (
        <div className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-bg)]/40 p-4">
          <p className="text-sm text-[var(--eos-muted)]">{historyReport.summary}</p>
          <div className="mt-3 space-y-3">
            {historyReport.sections.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-300">{section.title}</p>
                <div className="mt-2 space-y-1 text-sm">
                  {section.rows.map((row) => (
                    <p key={row.label}>
                      <span className="text-[var(--eos-muted)]">{row.label}: </span>
                      {row.value}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
