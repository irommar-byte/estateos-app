"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileSearch, ShieldCheck } from "lucide-react";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import {
  CarFormField,
  CarFormSection,
  carFieldInputClass,
} from "@/components/cars/carFormStyles";
import { formatPolishDateInput, isCompletePolishDate } from "@/utils/polishDateInput";

export type CarVehicleDocsFormState = {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  insuranceValidUntil: string;
  restrictVehicleDocs: boolean;
};

type CarVehicleDocsFieldsProps = {
  value: CarVehicleDocsFormState;
  onChange: (patch: Partial<CarVehicleDocsFormState>) => void;
  loggedIn?: boolean;
};

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
    if (!loggedIn || !canVerify) return;
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
    if (!loggedIn || !canVerify) return;
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
    <CarFormSection
      eyebrow="Dokumenty pojazdu"
      title="VIN i rejestracja"
      description="Dane z dowodu rejestracyjnego oraz weryfikacja CEPIK/UFG."
    >
      {!loggedIn ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
          Sprawdzenie historii pojazdu i OC wymaga zalogowania.{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            Zaloguj się
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <CarFormField label="Numer VIN">
          <input
            value={value.vin}
            onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })}
            className={carFieldInputClass}
            placeholder="17 znaków"
          />
        </CarFormField>

        <CarFormField label="Numer rejestracyjny">
          <input
            value={value.registrationNumber}
            onChange={(e) => onChange({ registrationNumber: e.target.value.toUpperCase() })}
            className={carFieldInputClass}
            placeholder="np. WH 9737A"
          />
        </CarFormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CarFormField label="Data pierwszej rejestracji">
          <input
            value={value.firstRegistrationDate}
            onChange={(e) => onChange({ firstRegistrationDate: formatPolishDateInput(e.target.value) })}
            className={carFieldInputClass}
            placeholder="DD.MM.RRRR"
            inputMode="numeric"
          />
        </CarFormField>

        <CarFormField label="Ważność polisy OC">
          <input
            value={value.insuranceValidUntil}
            onChange={(e) => onChange({ insuranceValidUntil: formatPolishDateInput(e.target.value) })}
            className={carFieldInputClass}
            placeholder="DD.MM.RRRR"
            inputMode="numeric"
          />
        </CarFormField>
      </div>

      <AppleStyleSwitch
        id="restrict-vehicle-docs"
        checked={value.restrictVehicleDocs}
        onChange={(restrictVehicleDocs) => onChange({ restrictVehicleDocs })}
        label="Zastrzeż dane pojazdu (VIN, rejestracja, pierwsza rejestracja)"
        description="Na stronie ogłoszenia i w raporcie historii CEPIK widoczne będą tylko pierwsze 2 znaki każdego z tych pól."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void handleHistory()}
          disabled={historyLoading || !loggedIn || !canVerify}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-45 dark:text-sky-200"
        >
          <FileSearch className="size-4" />
          {historyLoading ? "Sprawdzanie..." : "Sprawdź historię pojazdu"}
        </button>

        <button
          type="button"
          onClick={() => void handleInsurance()}
          disabled={insuranceLoading || !loggedIn || !canVerify}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45 dark:text-emerald-200"
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
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-600 dark:text-sky-300">
                  {section.title}
                </p>
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
    </CarFormSection>
  );
}
