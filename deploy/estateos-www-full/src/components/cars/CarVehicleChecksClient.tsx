"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import CarLiveRegistryButton from "@/components/cars/CarLiveRegistryButton";
import { useLocale } from "@/contexts/LocaleContext";
import {
  carAlertErrorClass,
  carAlertSuccessClass,
  carAlertWarningClass,
  carModalPanelClass,
  carOverlayBackdropClass,
} from "@/components/cars/carFormStyles";

type VehicleHistorySection = {
  title: string;
  rows: { label: string; value: string }[];
};

type VehicleHistoryReport = {
  summary: string;
  sections: VehicleHistorySection[];
};

type CarVehicleChecksClientProps = {
  carId?: number;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  insuranceValidUntil?: string;
  restrictVehicleDocs?: boolean;
  loggedIn?: boolean;
};

export default function CarVehicleChecksClient({
  carId,
  vin = "",
  registrationNumber = "",
  firstRegistrationDate = "",
  insuranceValidUntil = "",
  restrictVehicleDocs = false,
  loggedIn = false,
}: CarVehicleChecksClientProps) {
  const { dict } = useLocale();
  const c = dict.cars.checks;
  const [historyLoading, setHistoryLoading] = useState(false);
  const [insuranceLoading, setInsuranceLoading] = useState(false);
  const [historyReport, setHistoryReport] = useState<VehicleHistoryReport | null>(null);
  const [insuranceMessage, setInsuranceMessage] = useState<string | null>(null);
  const [insuranceOk, setInsuranceOk] = useState<boolean | null>(null);

  const hasHistoryData = Boolean(
    vin.trim().length >= 2 && registrationNumber.trim() && firstRegistrationDate.trim(),
  );
  const hasInsuranceData = Boolean(registrationNumber.trim());

  const historyPayload = carId
    ? { carId }
    : { vin, registrationNumber, firstRegistrationDate };

  const insurancePayload = carId
    ? { carId, insuranceValidUntil }
    : { registrationNumber, insuranceValidUntil, vin, firstRegistrationDate };

  const handleHistory = async () => {
    if (!loggedIn) return;
    if (!hasHistoryData) return;
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/cars/vehicle-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(historyPayload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : c.errHistory);
      }
      setHistoryReport(data.report as VehicleHistoryReport);
    } catch (error) {
      alert(error instanceof Error ? error.message : c.errHistory);
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
        body: JSON.stringify(insurancePayload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : c.errInsurance);
      }
      setInsuranceOk(Boolean(data.hasInsurance));
      setInsuranceMessage(String(data.message || ""));
    } catch (error) {
      alert(error instanceof Error ? error.message : c.errInsurance);
    } finally {
      setInsuranceLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-sky-400/25 bg-sky-500/[0.06] p-5 dark:bg-sky-950/20">
      <h2 className="text-sm font-black uppercase tracking-[0.14em] text-sky-700 dark:text-sky-300">{c.title}</h2>
      <p className="mt-2 text-sm text-[var(--eos-muted)]">
        {c.description}
        {restrictVehicleDocs ? c.restrictedNote : ""}
      </p>

      {!loggedIn ? (
        <p className={`mt-4 ${carAlertWarningClass}`}>
          {c.loginBanner}{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            {dict.cars.common.login}
          </Link>
        </p>
      ) : null}

      <div className="mt-4 grid gap-2 text-sm">
        {vin.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">{c.vin}: </span>
            <span className="font-semibold text-[var(--eos-text)]">{vin}</span>
          </p>
        ) : null}
        {registrationNumber.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">{c.registration}: </span>
            <span className="font-semibold text-[var(--eos-text)]">{registrationNumber}</span>
          </p>
        ) : null}
        {firstRegistrationDate.trim() ? (
          <p>
            <span className="text-[var(--eos-muted)]">{c.firstRegistration}: </span>
            <span className="font-semibold text-[var(--eos-text)]">{firstRegistrationDate}</span>
          </p>
        ) : null}
      </div>

      {!hasHistoryData ? <p className="mt-3 text-xs text-[var(--eos-muted)]">{c.historyNeedsData}</p> : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <CarLiveRegistryButton
          kind="history"
          label={historyLoading ? c.checkingHistory : c.checkHistory}
          active={loggedIn && hasHistoryData}
          loading={historyLoading}
          onClick={() => void handleHistory()}
        />
        <CarLiveRegistryButton
          kind="insurance"
          label={insuranceLoading ? c.checkingInsurance : c.checkInsurance}
          active={loggedIn && hasInsuranceData}
          loading={insuranceLoading}
          onClick={() => void handleInsurance()}
        />
      </div>

      {insuranceMessage ? (
        <p className={`mt-4 ${insuranceOk ? carAlertSuccessClass : carAlertErrorClass}`}>{insuranceMessage}</p>
      ) : null}

      {historyReport ? (
        <div className={`${carOverlayBackdropClass} flex items-end justify-center p-4 sm:items-center`}>
          <div className={`max-h-[85vh] w-full max-w-2xl ${carModalPanelClass}`}>
            <div className="flex items-center justify-between border-b border-[var(--eos-border)] px-5 py-4">
              <h3 className="text-lg font-semibold text-[var(--eos-text)]">{c.historyModalTitle}</h3>
              <button type="button" onClick={() => setHistoryReport(null)} aria-label={c.closeModal}>
                <X className="size-5 text-[var(--eos-muted)]" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <p className="text-sm text-[var(--eos-muted)]">{historyReport.summary}</p>
              <div className="mt-4 space-y-4">
                {historyReport.sections.map((section) => (
                  <div key={section.title} className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-surface)] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-600 dark:text-sky-300">{section.title}</p>
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
