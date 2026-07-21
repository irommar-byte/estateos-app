"use client";

import type { SummarySection } from "@/lib/addOfferSummary";

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
    <div className="min-w-[calc(50%-0.35rem)] flex-1 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-3 sm:min-w-[140px]">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--eos-muted)]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-snug text-[var(--eos-text)]">{value}</p>
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
      <p className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-500">{heading}</p>

      <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 px-1">
          {images.length > 0 ? (
            images.map((img, idx) => (
              <img
                key={`${img}-${idx}`}
                src={img}
                alt={photoAlt(idx + 1)}
                className="h-[220px] w-[min(85vw,340px)] shrink-0 rounded-[1.5rem] border border-[var(--eos-border)] object-cover shadow-[var(--eos-shadow-soft)]"
              />
            ))
          ) : (
            <div className="flex h-[180px] w-full items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--eos-border)] bg-[var(--eos-input)] px-6 text-center text-sm font-semibold text-[var(--eos-muted)]">
              {noPhotos}
            </div>
          )}
          {floorPlan ? (
            <img
              src={floorPlan}
              alt={floorPlanAlt}
              className="h-[220px] w-[min(50vw,200px)] shrink-0 rounded-[1.5rem] border border-emerald-500/30 object-cover"
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6">
        {title ? (
          <h3 className="mb-4 text-xl font-extrabold tracking-tight text-[var(--eos-text)] sm:text-2xl">{title}</h3>
        ) : null}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-extrabold tracking-tight text-[var(--eos-text)] sm:text-4xl">{priceLine}</p>
            {priceSubLine ? (
              <p className="mt-1.5 text-sm font-semibold text-[var(--eos-muted)]">{priceSubLine}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-xl px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
              isRent ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"
            }`}
          >
            {transactionLabel}
          </span>
        </div>

        <div className="my-5 h-px bg-[var(--eos-border)]" />

        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{locationHeading}</p>
        <p className="mt-1.5 text-base font-bold leading-snug text-[var(--eos-text)]">{locationLine || "—"}</p>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{paramsHeading}</p>
        <div className="flex flex-wrap gap-2.5">
          {badges.map((badge) => (
            <InfoBadge key={`${badge.label}-${badge.value}`} label={badge.label} value={badge.value} />
          ))}
        </div>
        <p className="mb-2 mt-6 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{mediaHeading}</p>
        <p className="text-sm font-semibold text-[var(--eos-muted)]">{mediaLine}</p>
      </div>

      <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{amenitiesHeading}</p>
        {amenities.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {amenities.map((item) => (
              <span
                key={item}
                className="rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3.5 py-2.5 text-sm font-bold text-[var(--eos-text)]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-[var(--eos-muted)]">{noAmenities}</p>
        )}
      </div>

      {descriptionText ? (
        <div className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{descriptionHeading}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--eos-text)]">{descriptionText}</p>
        </div>
      ) : null}

      {detailSections.map((section) => (
        <div
          key={section.title}
          className="rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-5 shadow-[var(--eos-shadow-soft)] sm:p-6"
        >
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--eos-muted)]">{section.title}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {section.rows.map((row) => (
              <div
                key={`${section.title}-${row.label}`}
                className="rounded-xl border border-[var(--eos-border)] bg-[var(--eos-input)] px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold tracking-wide text-[var(--eos-muted)]">{row.label}</p>
                <p className="mt-1 break-words text-[13px] font-semibold leading-relaxed text-[var(--eos-text)]">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
