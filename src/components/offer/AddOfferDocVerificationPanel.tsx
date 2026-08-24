"use client";

import React from "react";
import { EyeOff, Lock, Sparkles } from "lucide-react";
import type { AddOfferDictionary } from "@/i18n/addOfferDictionary";
import EstateOS3DVerifiedShield from "@/components/offer/EstateOS3DVerifiedShield";

const KW_COURT_SUGGESTIONS = [
  { prefix: "WA1M", court: "Warszawa-Mokotów" },
  { prefix: "WA4M", court: "Warszawa-Wola" },
  { prefix: "KR1P", court: "Kraków-Podgórze" },
  { prefix: "KR1K", court: "Kraków-Śródmieście" },
  { prefix: "GD1G", court: "Gdańsk-Północ" },
  { prefix: "PO1P", court: "Poznań-Stare Miasto" },
  { prefix: "WR1K", court: "Wrocław-Krzyki" },
  { prefix: "LU1I", court: "Lublin-Zachód" },
  { prefix: "ZA1Z", court: "Zamość" },
];

type LegalStatus = "NONE" | "PENDING" | "REJECTED" | "VERIFIED";

type Props = {
  ao: AddOfferDictionary;
  inputPremium: string;
  labelPremium: string;
  propertyType: string;
  apartmentNumber: string;
  landRegistryNumber: string;
  landRegistryValid: boolean;
  hasLandRegistryInput: boolean;
  onApartmentChange: (value: string) => void;
  onLandRegistryChange: (value: string) => void;
  landRegistryInputRef?: React.RefObject<HTMLInputElement | null>;
  /** Po akceptacji admina KW jest zablokowane dla właściciela. */
  kwLocked?: boolean;
  legalStatus?: LegalStatus;
};

export default function AddOfferDocVerificationPanel({
  ao,
  inputPremium,
  labelPremium,
  propertyType,
  apartmentNumber,
  landRegistryNumber,
  landRegistryValid,
  hasLandRegistryInput,
  onApartmentChange,
  onLandRegistryChange,
  landRegistryInputRef,
  kwLocked = false,
  legalStatus = "NONE",
}: Props) {
  const readyForReview = Boolean(landRegistryNumber.trim() && landRegistryValid);
  const shieldActive =
    legalStatus === "VERIFIED" || legalStatus === "PENDING" || readyForReview;
  const statusLabel =
    legalStatus === "VERIFIED"
      ? ao.docVerificationBadgeLabel
      : legalStatus === "PENDING" || readyForReview
        ? ao.docVerificationStatusReady
        : ao.docVerificationStatusSkip;

  const kwInputClass = `${inputPremium} min-w-0 w-full font-mono text-sm uppercase tracking-[0.08em] sm:text-base`;
  const showApartment =
    !propertyType ||
    propertyType === "FLAT" ||
    /mieszkanie|flat|apartment/i.test(String(propertyType));

  return (
    <section
      className="mt-8 w-full overflow-hidden rounded-[1.75rem] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] via-[var(--eos-card)] to-[var(--eos-card)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      aria-labelledby="doc-verification-heading"
    >
      <div className="grid w-full grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 p-5 sm:p-6 md:p-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300">
                <Sparkles size={11} className="text-emerald-400" />
                {ao.docVerificationOptionalBadge}
              </span>
              <h3
                id="doc-verification-heading"
                className="mt-2 text-lg font-black uppercase tracking-[0.06em] text-[var(--eos-text)] sm:text-xl"
              >
                {ao.docVerificationTitle}
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">{ao.docVerificationIntro}</p>
            </div>
            <span
              className={`inline-flex shrink-0 self-start rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
                legalStatus === "VERIFIED" || readyForReview
                  ? "border-emerald-500/40 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                  : legalStatus === "PENDING"
                    ? "border-amber-500/40 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                    : "border-[var(--eos-border)] bg-[var(--eos-surface)] text-[var(--eos-muted)]"
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <ul className="mb-6 grid gap-2 sm:grid-cols-3">
            {[ao.docVerificationBenefit1, ao.docVerificationBenefit2, ao.docVerificationBenefit3].map((text) => (
              <li
                key={text}
                className="flex items-start gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-[11px] leading-snug text-zinc-300"
              >
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                {text}
              </li>
            ))}
          </ul>

          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2">
            {showApartment ? (
              <div className="min-w-0">
                <label className={labelPremium}>{ao.docVerificationApartmentLabel}</label>
                <input
                  type="text"
                  inputMode="text"
                  placeholder={ao.aptNumberPlaceholder || ao.apartmentPlaceholder}
                  maxLength={32}
                  className={inputPremium}
                  value={apartmentNumber}
                  onChange={(e) => onApartmentChange(e.target.value.slice(0, 32))}
                />
              </div>
            ) : (
              <p className="text-[11px] leading-relaxed text-zinc-500 sm:col-span-2">
                {ao.docVerificationApartmentHintNonFlat}
              </p>
            )}
            <div className="min-w-0">
              <label className={labelPremium}>{ao.docVerificationKwLabel}</label>
              <input
                ref={landRegistryInputRef}
                type="text"
                inputMode="text"
                placeholder={ao.landRegistryExample}
                list="kw-court-suggestions"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={15}
                disabled={kwLocked}
                className={`${kwInputClass} ${kwLocked ? "cursor-not-allowed opacity-60" : ""} ${
                  hasLandRegistryInput && !landRegistryValid ? "border-red-500/50 focus:border-red-400" : ""
                }`}
                value={landRegistryNumber}
                onChange={(e) => onLandRegistryChange(e.target.value)}
              />
              <datalist id="kw-court-suggestions">
                {KW_COURT_SUGGESTIONS.map((entry) => (
                  <option key={entry.prefix} value={`${entry.prefix}/00000000/0`}>
                    {entry.prefix} — Sąd Rejonowy {entry.court}
                  </option>
                ))}
              </datalist>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{ao.docVerificationKwHint}</p>
              {hasLandRegistryInput && !landRegistryValid ? (
                <p className="mt-2 text-[10px] font-bold text-red-400">{ao.docVerificationKwFormatError}</p>
              ) : null}
            </div>
          </div>

          <p className="mt-5 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400">
            <EyeOff size={14} className="mt-0.5 shrink-0 text-zinc-500" />
            {ao.docVerificationPrivacy}
          </p>
        </div>

        <aside className="flex min-w-0 flex-col items-center justify-center border-t border-emerald-500/15 bg-gradient-to-b from-emerald-500/[0.06] to-emerald-950/20 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <p className="mb-1 text-center text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/90">
            {ao.docVerificationPreviewKicker}
          </p>
          <p className="mb-6 max-w-xs text-center text-xs leading-relaxed text-zinc-400">
            {ao.docVerificationPreviewBody}
          </p>

          <EstateOS3DVerifiedShield
            size="hero"
            label={
              legalStatus === "VERIFIED" || shieldActive
                ? ao.docVerificationBadgeLabel
                : ao.docVerificationBadgeInactiveLabel
            }
            sublabel={ao.docVerificationBadgeSublabel}
            active={shieldActive}
            tilt={legalStatus === "VERIFIED" || readyForReview}
          />

          <div className="mt-6 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2">
            <Lock size={12} className="text-emerald-400/80" />
            <span className="text-[10px] font-semibold text-zinc-400">{ao.docVerificationPreviewTrust}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
