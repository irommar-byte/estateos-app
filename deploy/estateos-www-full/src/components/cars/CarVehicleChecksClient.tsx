"use client";

import Link from "next/link";
import { useState } from "react";
import { FileSearch, ShieldCheck, X } from "lucide-react";

type VehicleHistorySection = {
  title: string;
  rows: { label: string; value: string }[];
};

type VehicleHistoryReport = {
  summary: string;
  sections: VehicleHistorySection[];
};

type CarVehicleChecksClientProps = {
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  loggedIn?: boolean;
};

export default function CarVehicleChecksClient({
  vin = "",
  registrationNumber = "",
  firstRegistrationDate = "",
  insuranceValidUntil = "",
  loggedIn = false,
}: CarVehicleChecksClientProps) {
  const [historyLoading, setHistoryLoading] = useState(false);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [historyReport, setHistoryReport] = useState<VehicleHistoryReport | null>(null);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [insuranceOk, setInsuranceOk] = useState<boolean | null>(null);

  const hasHistoryData = Boolean(
    vin.trim().length === 17 && registrationNumber.trim() && firstRegistrationDate.trim(),
  );
  const hasInsuranceData = hasHistoryData;

  const handleHistory = async () => {
    if (!loggedIn) return;
    if (!hasHistoryData) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/cars/vehicle-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vin, registrationNumber, firstRegistrationDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się pobrać historii pojazdu.");
      }
      setHistoryReport(data.report as VehicleHistoryReport);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd sprawdzania historii.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInsurance = async () => {
    if (!loggedIn) return;
    if (!hasInsuranceData) return;
    setInsuranceLoading(true);
    try {
      const response = await fetch("/api/cars/insurance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vin, registrationNumber, firstRegistrationDate, insuranceValidUntil }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Nie udało się sprawdzić ubezpieczenia.");
      }
      setInsuranceOk(Boolean(data.hasInsurance));
      setInsuranceMessage(String(data.message || ""));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Błąd sprawdzania ubezpieczenia.");
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-950/20 p-5">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-300">Weryfikacja pojazdu</h2>
      <p className="mt-2 text-sm text-[var(--eos-muted)]">
        Sprawdź historię w CEPIK i ważność OC (UFG) na podstawie danych z ogłoszenia.
      </p>

      {!loggedIn ? (
        <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-50">
          Sprawdzenie historii pojazdu i OC wymaga zalogowania.{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            Zaloguj się
          </Link>
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm">
        {vin.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">VIN: </span>
            <span className="font-semibold">{vin}</span>
          </p>
        ) : null}
        {registrationNumber.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">Rejestracja: </span>
            <span className="font-semibold">{registrationNumber}</span>
          </p>
        ) : null}
        {firstRegistrationDate.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">Pierwsza rejestracja: </span>
            <span className="font-semibold">{firstRegistrationDate}</span>
          </p>
        ) : null}
      </div>

      {!hasHistoryData ? (
        <p className="mt-3 text-xs text-[var(--eos-muted)]">
          Pełna historia CEPIK wymaga VIN, tablicy i daty pierwszej rejestracji od sprzedającego.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleHistory()}
          disabled={historyLoading || !loggedIn || !hasHistoryData}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-sky-700 disabled:opacity-45 dark:text-sky-200"
        >
          <FileSearch className="size-4" />
          {historyLoading ? "Sprawdzanie..." : "Sprawdź historię pojazdu"}
        </button>
        <button
          type="button"
          onClick={() => void handleInsurance()}
          disabled={insuranceLoading || !loggedIn || !hasInsuranceData}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 disabled:opacity-45 dark:text-emerald-200"
        >
          <ShieldCheck className="size-4" />
          {insuranceLoading ? "Sprawdzanie..." : "Sprawdź ubezpieczenie"}
        </button>
      </div>

      {insuranceMessage ? (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            insuranceOk
              ? "border-emerald-400/30 bg-emerald-900/15 text-emerald-100"
              : "border-red-400/30 bg-red-950/20 text-red-100"
          }`}
        >
          {insuranceMessage}
        </p>
      ) : null}

      {historyReport ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-card)]">
            <div className="flex items-center justify-between border-b border-[var(--eos-border)] px-5 py-4">
              <h3 className="text-lg font-semibold">Historia pojazdu</h3>
              <button type="button" onClick={() => setHistoryReport(null)} aria-label="Zamknij">
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <p className="text-sm text-[var(--eos-muted)]">{historyReport.summary}</p>
              <div className="mt-4 space-y-4">
                {historyReport.sections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-[var(--eos-border)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-300">{section.title}</p>
                    <div className="mt-3 space-y-2">
                      {section.rows.map((row) => (
                        <div key={row.label}>
                          <p className="text-[11px] uppercase tracking-wide text-[var(--eos-muted)]">{row.label}</p>
                          <p className="text-sm font-semibold">{row.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
