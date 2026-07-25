"use client";

import type { ReactNode } from "react";
import { Briefcase, Eye, MessageCircleQuestion, ShieldCheck, Star } from "lucide-react";

type Props = {
  sellerLabel: string;
  sellerPersonLine?: string | null;
  sellerAvatar?: string | null;
  sellerIsAgency?: boolean;
  averageRating: number;
  totalReviews: number;
  isOnline: boolean;
  isOwner: boolean;
  canAsk: boolean;
  views: number;
  offerId: string | number;
  listedAtLabel: string;
  isLegalKwVerified: boolean;
  isNewListing: boolean;
  themeTextActive: string;
  themeBgActiveSoft: string;
  themeBorderActive: string;
  labels: {
    ask: string;
    views: string;
    offerId: string;
    listedSince: string;
    online: string;
    offline: string;
    legalVerifiedKw: string;
    legalUnverifiedKw: string;
    legalVerifiedKwSublabel: string;
    newOfferBadge: string;
    noData: string;
  };
  onOpenProfile: () => void;
  onAsk: () => void;
};

function PresenceDot({
  online,
  onlineLabel,
  offlineLabel,
}: {
  online: boolean;
  onlineLabel: string;
  offlineLabel: string;
}) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-300">
          {onlineLabel}
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-zinc-500" />
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">
        {offlineLabel}
      </span>
    </span>
  );
}

function MetaCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="truncate text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

export default function OfferHeroMetaBar({
  sellerLabel,
  sellerPersonLine,
  sellerAvatar,
  sellerIsAgency,
  averageRating,
  totalReviews,
  isOnline,
  isOwner,
  canAsk,
  views,
  offerId,
  listedAtLabel,
  isLegalKwVerified,
  isNewListing,
  themeTextActive,
  themeBgActiveSoft,
  themeBorderActive,
  labels,
  onOpenProfile,
  onAsk,
}: Props) {
  const filledStars = totalReviews > 0 ? Math.max(0, Math.min(5, Math.round(averageRating))) : 0;
  const kwLabel = isLegalKwVerified ? labels.legalVerifiedKw : labels.legalUnverifiedKw;

  return (
    <div className="eos-offer-hero-meta w-full overflow-hidden rounded-[1.65rem]">
      <div className="grid w-full gap-3 px-3.5 py-3.5 sm:px-5 sm:py-4 lg:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.6fr)] lg:items-center lg:gap-4">
        {/* Seller */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenProfile();
          }}
          className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl text-left transition hover:opacity-95"
        >
          <div
            className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/18 bg-gradient-to-br from-white/20 to-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${themeTextActive}`}
          >
            {sellerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sellerAvatar} alt="" className="h-full w-full object-cover" />
            ) : sellerIsAgency ? (
              <Briefcase size={17} />
            ) : (
              <span className="text-[15px]">👤</span>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="truncate text-[12px] font-black uppercase tracking-[0.12em] text-white">
                {sellerLabel}
              </span>
              <PresenceDot online={isOnline} onlineLabel={labels.online} offlineLabel={labels.offline} />
            </div>
            {sellerPersonLine ? (
              <p className="mt-0.5 truncate text-[11px] font-semibold tracking-wide text-white/55">
                {sellerPersonLine}
              </p>
            ) : null}
            <div
              className="mt-1.5 flex items-center gap-1"
              aria-label={totalReviews > 0 ? `${averageRating.toFixed(1)} / 5` : undefined}
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={11}
                  className={i <= filledStars ? "fill-amber-400 text-amber-400" : "text-white/22"}
                />
              ))}
              {totalReviews > 0 ? (
                <span className="ml-1 text-[10px] font-bold tracking-wide text-amber-300/90">
                  {averageRating.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
        </button>

        {/* CTA */}
        {!isOwner && canAsk ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAsk();
            }}
            className="eos-offer-hero-ask inline-flex min-h-[3rem] w-full shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[11px] font-black uppercase tracking-[0.16em] transition hover:brightness-105 active:scale-[0.985] lg:w-auto lg:min-w-[10rem]"
          >
            <MessageCircleQuestion className="size-4 shrink-0" strokeWidth={2.2} />
            {labels.ask}
          </button>
        ) : (
          <div className="hidden lg:block" />
        )}

        {/* Meta grid — each cell clipped, never stacks on neighbours */}
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <MetaCell label={labels.views}>
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="shrink-0 text-white/55" />
              <span className="truncate text-[13px] font-black tracking-wide text-white">{views}</span>
            </div>
          </MetaCell>

          <MetaCell label={labels.legalVerifiedKwSublabel || "KW"}>
            <div className="flex min-w-0 items-center gap-1.5">
              <ShieldCheck
                size={14}
                className={`shrink-0 ${isLegalKwVerified ? "text-emerald-400" : "text-zinc-500"}`}
                strokeWidth={2.2}
              />
              <span
                className={`truncate text-[10px] font-black uppercase tracking-[0.06em] ${
                  isLegalKwVerified ? "text-emerald-200" : "text-zinc-400"
                }`}
                title={kwLabel}
              >
                {kwLabel}
              </span>
            </div>
          </MetaCell>

          <MetaCell label={labels.offerId}>
            <span
              className={`inline-block max-w-full truncate rounded-md border px-2 py-0.5 text-[12px] font-black tracking-[0.12em] ${themeTextActive} ${themeBgActiveSoft} ${themeBorderActive}`}
            >
              {offerId}
            </span>
          </MetaCell>

          <MetaCell label={labels.listedSince}>
            <p className="truncate text-[12px] font-black tracking-wide text-white/85">
              {listedAtLabel || labels.noData}
            </p>
          </MetaCell>
        </div>
      </div>

      {isNewListing ? (
        <div className="border-t border-white/10 px-5 py-2">
          <span className="inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-sky-200">
            {labels.newOfferBadge}
          </span>
        </div>
      ) : null}
    </div>
  );
}
