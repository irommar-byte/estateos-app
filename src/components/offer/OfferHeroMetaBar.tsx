'use client';

import { Briefcase, Eye, MessageCircleQuestion, Star } from 'lucide-react';
import LegalVerifiedShieldBadge from '@/components/offer/LegalVerifiedShieldBadge';

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

function PresenceDot({ online, onlineLabel, offlineLabel }: { online: boolean; onlineLabel: string; offlineLabel: string }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-55" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-300/95">{onlineLabel}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-2 w-2 rounded-full bg-zinc-500" />
      <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">{offlineLabel}</span>
    </span>
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

  return (
    <div className="w-full rounded-[22px] border border-white/12 bg-zinc-950/90 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-3xl">
      <div className="grid w-full grid-cols-1 items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-3.5 lg:grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1.45fr)]">
        {/* Seller */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenProfile();
          }}
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.07]"
        >
          <div
            className={`flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/12 bg-gradient-to-br from-white/15 to-transparent ${themeTextActive}`}
          >
            {sellerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sellerAvatar} alt="" className="h-full w-full object-cover" />
            ) : sellerIsAgency ? (
              <Briefcase size={16} />
            ) : (
              <span className="text-[15px]">👤</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-[11px] font-black uppercase tracking-[0.14em] text-white">
                {sellerLabel}
              </span>
              <PresenceDot online={isOnline} onlineLabel={labels.online} offlineLabel={labels.offline} />
            </div>
            {sellerPersonLine ? (
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {sellerPersonLine}
              </p>
            ) : null}
            <div className="mt-1.5 flex items-center gap-1" aria-label={totalReviews > 0 ? `${averageRating.toFixed(1)} / 5` : undefined}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={11}
                  className={i <= filledStars ? 'fill-amber-400 text-amber-400' : 'text-white/20'}
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
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500 px-5 text-[11px] font-black uppercase tracking-[0.16em] text-black shadow-[0_10px_28px_rgba(16,185,129,0.28)] transition hover:bg-emerald-400 lg:w-auto lg:min-w-[9.5rem]"
          >
            <MessageCircleQuestion className="size-4" strokeWidth={2.2} />
            {labels.ask}
          </button>
        ) : (
          <div className="hidden lg:block" />
        )}

        {/* Meta cluster */}
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:justify-items-stretch">
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">{labels.views}</p>
            <div className="mt-1 flex items-center justify-center gap-1.5">
              <Eye size={12} className="text-zinc-400" />
              <span className="text-[11px] font-black tracking-widest text-white">{views}</span>
            </div>
          </div>

          <div className="flex items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] px-1.5 py-1.5">
            <LegalVerifiedShieldBadge
              active={isLegalKwVerified}
              label={isLegalKwVerified ? labels.legalVerifiedKw : labels.legalUnverifiedKw}
              sublabel={labels.legalVerifiedKwSublabel}
              variant="bar"
            />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">{labels.offerId}</p>
            <span
              className={`mt-1 inline-block rounded-md border px-2 py-0.5 text-[11px] font-black tracking-[0.16em] ${themeTextActive} ${themeBgActiveSoft} ${themeBorderActive}`}
            >
              {offerId}
            </span>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-2 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-zinc-500">{labels.listedSince}</p>
            <p className="mt-1 text-[11px] font-black tracking-wide text-white/75">{listedAtLabel || labels.noData}</p>
          </div>
        </div>
      </div>

      {isNewListing ? (
        <div className="border-t border-white/8 px-4 py-2">
          <span className="inline-flex rounded-full border border-blue-500/45 bg-blue-500/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-blue-300">
            {labels.newOfferBadge}
          </span>
        </div>
      ) : null}
    </div>
  );
}
