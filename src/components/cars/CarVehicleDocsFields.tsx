"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileSearch, ShieldCheck } from "lucide-react";
import AppleStyleSwitch from "@/components/ui/AppleStyleSwitch";
import {
  CarFormField,
  CarFormSection,
  carAlertErrorClass,
  carAlertSuccessClass,
  carAlertWarningClass,
  carFieldInputClass,
} from "@/components/cars/carFormStyles";
import { useLocale } from "@/contexts/LocaleContext";
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
  const { dict } = useLocale();
  const d = dict.cars.docs;
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
          if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : d.errOc);
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
        throw new Error(typeof data?.error === "string" ? data.error : d.errHistory);
      }
      setHistoryReport(data.report);
    } catch (error) {
      alert(error instanceof Error ? error.message : d.errHistory);
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
        throw new Error(typeof data?.error === "string" ? data.error : d.errInsurance);
      }
      setInsuranceOk(Boolean(data.hasInsurance));
      setInsuranceMessage(String(data.message || ""));
      if (data.validUntil) onChange({ insuranceValidUntil: String(data.validUntil) });
    } catch (error) {
      alert(error instanceof Error ? error.message : d.errInsurance);
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <CarFormSection eyebrow={d.eyebrow} title={d.title} description={d.description}>
      {!loggedIn ? (
        <p className={carAlertWarningClass}>
          {d.loginBanner}{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            {dict.cars.common.login}
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <CarFormField label={d.vinLabel}>
          <input
            value={value.vin}
            onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })}
            className={carFieldInputClass}
            placeholder={d.vinPlaceholder}
          />
        </CarFormField>

        <CarFormField label={d.registrationLabel}>
          <input
            value={value.registrationNumber}
            onChange={(e) => onChange({ registrationNumber: e.target.value.toUpperCase() })}
            className={carFieldInputClass}
            placeholder={d.registrationPlaceholder}
          />
        </CarFormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <CarFormField label={d.firstRegLabel}>
          <input
            value={value.firstRegistrationDate}
            onChange={(e) => onChange({ firstRegistrationDate: formatPolishDateInput(e.target.value) })}
            className={carFieldInputClass}
            placeholder={d.firstRegPlaceholder}
            inputMode="numeric"
          />
        </CarFormField>

        <CarFormField label={d.insuranceLabel}>
          <input
            value={value.insuranceValidUntil}
            onChange={(e) => onChange({ insuranceValidUntil: formatPolishDateInput(e.target.value) })}
            className={carFieldInputClass}
            placeholder={d.insurancePlaceholder}
            inputMode="numeric"
          />
        </CarFormField>
      </div>

      <AppleStyleSwitch
        id="restrict-vehicle-docs"
        checked={value.restrictVehicleDocs}
        onChange={(restrictVehicleDocs) => onChange({ restrictVehicleDocs })}
        label={d.restrictLabel}
        description={d.restrictDescription}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void handleHistory()}
          disabled={historyLoading || !loggedIn || !canVerify}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/35 bg-sky-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-sky-700 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-45 dark:text-sky-200"
        >
          <FileSearch className="size-4" />
          {historyLoading ? d.checkingHistory : d.checkHistory}
        </button>

        <button
          type="button"
          onClick={() => void handleInsurance()}
          disabled={insuranceLoading || !loggedIn || !canVerify}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-45 dark:text-emerald-200"
        >
          <ShieldCheck className="size-4" />
          {insuranceLoading ? d.checkingInsurance : d.checkInsurance}
        </button>
      </div>

      {loggedIn && autoChecking ? <p className="text-xs text-[var(--eos-muted)]">{d.autoChecking}</p> : null}

      {insuranceMessage ? (
        <p className={insuranceOk ? carAlertSuccessClass : carAlertWarningClass}>{insuranceMessage}</p>
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
