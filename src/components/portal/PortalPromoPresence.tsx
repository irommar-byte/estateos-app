"use client";

import { useMemo } from "react";
import MarketingChannelBrand from "@/components/portal/MarketingChannelBrand";
import {
  livePromotionChannelIds,
  PORTAL_PROMO_STRIP_IDS,
  type MarketingChannelId,
} from "@/lib/crm/marketingChannel";
import { otherPortalsPresenceCount } from "@/lib/crm/otherPortalsPresence";
import type { ListingPathEvent } from "@/components/portal/ListingPathEventCard";

function AgenciesGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M4.5 19.5V8.2L12 3.8l7.5 4.4v11.3h-5.1v-6.2h-4.8v6.2H4.5Z" />
    </svg>
  );
}

function PortalsGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8Zm0 1.8c1.5 0 2.9.8 3.9 2.1H8.1A5.9 5.9 0 0 1 12 5.4Zm-6.4 6.6h12.8A6.5 6.5 0 0 1 12 17.2 6.5 6.5 0 0 1 5.6 12Z" />
    </svg>
  );
}

export default function PortalPromoPresence({
  listing,
  listingPath,
  activeChannels,
  otherAgencies,
}: {
  listing?: {
    id?: number | null;
    featured?: boolean | null;
    promotedUntil?: string | null;
    createdAt?: string | null;
  } | null;
  listingPath?: ListingPathEvent[];
  activeChannels?: Array<{ portal?: string | null; status?: string | null }>;
  otherAgencies?: { live?: boolean; body?: string | null } | null;
}) {
  const live = useMemo(
    () =>
      livePromotionChannelIds({
        listing,
        listingPath,
        activeChannels,
      }),
    [listing, listingPath, activeChannels],
  );

  const agenciesOn = Boolean(otherAgencies?.live);
  const agenciesBody = String(otherAgencies?.body || "").trim();
  const portalsCount = otherPortalsPresenceCount(
    Number(listing?.id || 0),
    listing?.createdAt,
  );

  return (
    <section className="portal-promo-strip portal-promo-strip--card" aria-label="Gdzie oferta jest promowana">
      <p className="portal-promo-strip__kicker">Promocja teraz</p>
      <div className="portal-promo-strip__row">
        {PORTAL_PROMO_STRIP_IDS.map((id: MarketingChannelId) => {
          const on = live.has(id);
          return (
            <div
              key={id}
              className={`portal-promo-chip portal-promo-chip--${id} ${
                on ? "portal-promo-chip--on" : "portal-promo-chip--off"
              }`}
            >
              <MarketingChannelBrand id={id} compact inactive={!on} />
              <span className="sr-only">{on ? "aktywna" : "brak publikacji"}</span>
            </div>
          );
        })}
        <div
          className={`portal-promo-chip portal-promo-chip--agencies ${
            agenciesOn ? "portal-promo-chip--on" : "portal-promo-chip--off"
          }`}
        >
          <span className="portal-promo-chip__mark" aria-hidden>
            <AgenciesGlyph />
          </span>
          <span className="portal-promo-chip__word">Inne agencje</span>
          <span className="sr-only">{agenciesOn ? "aktywna" : "brak publikacji"}</span>
        </div>
        <div className="portal-promo-chip portal-promo-chip--portals portal-promo-chip--on">
          <span className="portal-promo-chip__mark" aria-hidden>
            <PortalsGlyph />
          </span>
          <span className="portal-promo-chip__count">{portalsCount}</span>
          <span className="sr-only">Inne portale: {portalsCount}</span>
        </div>
      </div>
      {agenciesOn && agenciesBody ? (
        <p className="portal-promo-strip__note">{agenciesBody}</p>
      ) : null}
    </section>
  );
}
