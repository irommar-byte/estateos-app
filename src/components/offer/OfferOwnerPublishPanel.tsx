"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExternalLink, Facebook, Pencil, Share2 } from "lucide-react";
import OfferShareLink from "@/components/offer/OfferShareLink";
import { useLocale } from "@/contexts/LocaleContext";
import { getOfferModalsDictionary } from "@/i18n/offerModalsDictionary";
import { offerCardPreviewPath, offerSharePath } from "@/lib/publicListingPath";

const DEFAULT_ORIGIN = "https://estateos.pl";

function resolveOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const env = process.env.NEXT_PUBLIC_SITE_ORIGIN?.trim().replace(/\/$/, "");
  return env || DEFAULT_ORIGIN;
}

export default function OfferOwnerPublishPanel({
  offerId,
  presentingAgentId,
}: {
  offerId: number;
  presentingAgentId?: number;
}) {
  const { locale } = useLocale();
  const copy = getOfferModalsDictionary(locale).ownerPublish;

  const shareUrl = useMemo(() => {
    return `${resolveOrigin()}${offerSharePath(offerId, { presentingAgentId })}`;
  }, [offerId, presentingAgentId]);

  const previewHref = useMemo(() => {
    return offerCardPreviewPath(offerId, { presentingAgentId });
  }, [offerId, presentingAgentId]);

  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex flex-col gap-4 relative z-10">
      <div className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-center">
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
          <Share2 size={18} />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">{copy.kicker}</p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{copy.lead}</p>
      </div>

      <OfferShareLink offerId={offerId} presentingAgentId={presentingAgentId} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#1877F2]/35 bg-[#1877F2]/15 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#1877F2]/25"
        >
          <Facebook size={16} />
          {copy.facebook}
        </a>
        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          <ExternalLink size={16} />
          {copy.previewCard}
        </a>
      </div>

      <p className="text-[9px] leading-relaxed text-white/40 text-center px-2">{copy.portalsHint}</p>

      <Link
        href={`/edytuj-oferte/${offerId}`}
        className="inline-flex items-center justify-center gap-2 rounded-[2rem] bg-white px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
      >
        <Pencil size={15} />
        {copy.editOffer}
      </Link>
    </div>
  );
}
