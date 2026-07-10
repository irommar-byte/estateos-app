"use client";

import Link from "next/link";
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
  loggedIn?: boolean;
};

const fieldLabelClass =
  "text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]";

const fieldInputClass =
  "w-full rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] px-3.5 py-2.5 text-sm text-[var(--eos-text)] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] outline-none transition focus:border-sky-400/55 focus:ring-2 focus:ring-sky-400/20";

function isValidVinQuick(vin: string) {
  const normalized = vin.trim().toUpperCase();
  return normalized.length === 17 && !/[IOQ]/.test(normalized);
}

export default function CarVehicleDocsFields({ value, onChange, loggedIn = false }: CarVehicleDocsFieldsProps) {
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
    if (!loggedIn || !canVerify) return;
    const seq = ++autoCheckSeq.current;
    const timer = setTimeout(() => {
      setAutoChecking(true);
      fetch("/api/cars/insurance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
  }, [loggedIn, canVerify, value.vin, value.registrationNumber, value.firstRegistrationDate, value.insuranceValidUntil]);

  const handleHistory = async () => {
    if (!loggedIn) return;
    if (!canVerify) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/cars/vehicle-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
    if (!loggedIn) return;
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
    <section className="overflow-hidden rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] shadow-[0_22px_70px_rgba(14,165,233,0.06)]">
      <div className="border-b border-[var(--eos-border)] bg-gradient-to-r from-sky-500/[0.07] via-transparent to-cyan-500/[0.04] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-500">Dokumenty pojazdu</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--eos-text)]">VIN i rejestracja</h2>
        <p className="mt-1 text-xs text-[var(--eos-muted)]">Dane z dowodu rejestracyjnego oraz weryfikacja CEPIK/UFG.</p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6">
        {!loggedIn ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
            Sprawdzenie historii pojazdu i OC wymaga zalogowania.{" "}
            <Link href="/login" className="font-bold underline underline-offset-2">
              Zaloguj się
            </Link>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className={fieldLabelClass}>Numer VIN</span>
            <input
              value={value.vin}
              onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })}
              className={fieldInputClass}
              placeholder="17 znaków"
            />
          </label>

          <label className="grid gap-2">
            <span className={fieldLabelClass}>Numer rejestracyjny</span>
            <input
              value={value.registrationNumber}
              onChange={(e) => onChange({ registrationNumber: e.target.value.toUpperCase() })}
              className={fieldInputClass}
              placeholder="np. WH 9737A"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className={fieldLabelClass}>Data pierwszej rejestracji</span>
            <input
              value={value.firstRegistrationDate}
              onChange={(e) => onChange({ firstRegistrationDate: formatPolishDateInput(e.target.value) })}
              className={fieldInputClass}
              placeholder="DD.MM.RRRR"
              inputMode="numeric"
            />
          </label>

          <label className="grid gap-2">
            <span className={fieldLabelClass}>Ważność polisy OC</span>
            <input
              value={value.insuranceValidUntil}
              onChange={(e) => onChange({ insuranceValidUntil: formatPolishDateInput(e.target.value) })}
              className={fieldInputClass}
              placeholder="DD.MM.RRRR"
              inputMode="numeric"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleHistory()}
            disabled={historyLoading || !loggedIn || !canVerify}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-sky-700 disabled:opacity-45 dark:text-sky-200"
          >
            <FileSearch className="size-4" />
            {historyLoading ? "Sprawdzanie..." : "Sprawdź historię pojazdu"}
          </button>

          <button
            type="button"
            onClick={() => void handleInsurance()}
            disabled={insuranceLoading || !loggedIn || !canVerify}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 disabled:opacity-45 dark:text-emerald-200"
          >
            <ShieldCheck className="size-4" />
            {insuranceLoading ? "Sprawdzanie..." : "Sprawdź ubezpieczenie"}
          </button>
        </div>

        {loggedIn && autoChecking ? <p className="text-xs text-[var(--eos-muted)]">Sprawdzam OC w CEPIK/UFG...</p> : null}

        {insuranceMessage ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              insuranceOk
                ? "border-emerald-400/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-900/15 dark:text-emerald-100"
                : "border-amber-500/30 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100"
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
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-600 dark:text-sky-300">{section.title}</p>
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
    </section>
  );
}
