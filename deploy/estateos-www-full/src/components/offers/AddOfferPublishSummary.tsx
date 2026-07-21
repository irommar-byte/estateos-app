"use client";

import type { SummarySection } from "@/lib/addOfferSummary";
import { ImageIcon, MapPin, Sparkles } from "lucide-react";

type AddOfferPublishSummaryProps = {
  heading: string;
  title: string;
  priceLine: string;
  priceSubLine?: string;
  transactionLabel: string;
  isRent: boolean;
  locationHeading: string;
  locationLine: string;
  paramsHeading: string;
  badges: { label: string; value: string }[];
  amenitiesHeading: string;
  amenities: string[];
  noAmenities: string;
  mediaHeading: string;
  mediaLine: string;
  images: string[];
  floorPlan: string | null;
  noPhotos: string;
  photoAlt: (n: number) => string;
  floorPlanAlt: string;
  descriptionHeading: string;
  descriptionText: string;
  detailSections: SummarySection[];
};

function InfoBadge({ label, value }: { label: string; value: string }) {
  if (!String(value || "").trim()) return null;
  return (
    <div className="min-w-[calc(50%-0.4rem)] flex-1 rounded-2xl border border-[var(--eos-border)] bg-gradient-to-b from-[var(--eos-input)] to-transparent px-3.5 py-3 sm:min-w-[148px]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{label}</p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-[var(--eos-text)]">{value}</p>
    </div>
  );
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.85rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6 ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      {children}
    </div>
  );
}

/** Podsumowanie publikacji w stylu Apple (jak Step6 w aplikacji). */
export default function AddOfferPublishSummary({
  heading,
  title,
  priceLine,
  priceSubLine,
  transactionLabel,
  isRent,
  locationHeading,
  locationLine,
  paramsHeading,
  badges,
  amenitiesHeading,
  amenities,
  noAmenities,
  mediaHeading,
  mediaLine,
  images,
  floorPlan,
  noPhotos,
  photoAlt,
  floorPlanAlt,
  descriptionHeading,
  descriptionText,
  detailSections,
}: AddOfferPublishSummaryProps) {
  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">{heading}</p>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 px-1">
          {images.length > 0 ? (
            images.map((img, idx) => (
              <div key={`${img}-${idx}`} className="relative shrink-0">
                <img
                  src={img}
                  alt={photoAlt(idx + 1)}
                  className="h-[230px] w-[min(85vw,350px)] rounded-[1.6rem] border border-[var(--eos-border)] object-cover shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                  {idx + 1}/{images.length}
                </span>
              </div>
            ))
          ) : (
            <div className="flex h-[180px] w-full flex-col items-center justify-center gap-2 rounded-[1.6rem] border border-dashed border-[var(--eos-border)] bg-[var(--eos-input)] px-6 text-center">
              <ImageIcon className="h-8 w-8 text-[var(--eos-muted)]" />
              <p className="text-sm font-semibold text-[var(--eos-muted)]">{noPhotos}</p>
            </div>
          )}
          {floorPlan ? (
            <div className="relative shrink-0">
              <img
                src={floorPlan}
                alt={floorPlanAlt}
                className="h-[230px] w-[min(50vw,200px)] rounded-[1.6rem] border border-emerald-500/35 object-cover"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black">
                Plan
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <SectionCard>
        {title ? (
          <h3 className="mb-5 text-xl font-extrabold tracking-tight text-[var(--eos-text)] sm:text-2xl">
            {title}
          </h3>
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-extrabold tracking-tight text-[var(--eos-text)] sm:text-4xl">
              {priceLine}
            </p>
            {priceSubLine ? (
              <p className="mt-2 text-sm font-semibold text-[var(--eos-muted)]">{priceSubLine}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${
              isRent
                ? "bg-blue-500/15 text-blue-400 ring-blue-400/25"
                : "bg-emerald-500/15 text-emerald-400 ring-emerald-400/25"
            }`}
          >
            {transactionLabel}
          </span>
        </div>

        <div className="my-5 h-px bg-gradient-to-r from-transparent via-[var(--eos-border)] to-transparent" />

        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
              {locationHeading}
            </p>
            <p className="mt-1 text-base font-bold leading-snug text-[var(--eos-text)]">
              {locationLine || "—"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
          {paramsHeading}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {badges.map((badge) => (
            <InfoBadge key={`${badge.label}-${badge.value}`} label={badge.label} value={badge.value} />
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)]/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            {mediaHeading}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--eos-text)]">{mediaLine}</p>
        </div>
      </SectionCard>

      <SectionCard>
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
          {amenitiesHeading}
        </p>
        {amenities.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {amenities.map((item) => (
              <span
                key={item}
                className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm font-bold text-[var(--eos-text)]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-[var(--eos-muted)]">{noAmenities}</p>
        )}
      </SectionCard>

      {descriptionText ? (
        <SectionCard>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            {descriptionHeading}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-text)]/90">
            {descriptionText}
          </p>
        </SectionCard>
      ) : null}

      {detailSections.map((section) => (
        <SectionCard key={section.title}>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">
            {section.title}
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {section.rows.map((row) => (
              <div
                key={`${section.title}-${row.label}`}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)]/70 px-3.5 py-3"
              >
                <p className="text-[10px] font-semibold tracking-wide text-[var(--eos-muted)]">{row.label}</p>
                <p className="mt-1 break-words text-[13px] font-semibold leading-relaxed text-[var(--eos-text)]">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
