"use client";

import { useMemo } from "react";
import MarketingChannelBrand from "@/components/portal/MarketingChannelBrand";
import {
  livePromotionChannelIds,
  PORTAL_PROMO_STRIP_IDS,
  type MarketingChannelId,
} from "@/lib/crm/marketingChannel";
import type { ListingPathEvent } from "@/components/portal/ListingPathEventCard";

export default function PortalPromoPresence({
  listing,
  listingPath,
  activeChannels,
}: {
  listing?: { featured?: boolean | null; promotedUntil?: string | null } | null;
  listingPath?: ListingPathEvent[];
  activeChannels?: Array<{ portal?: string | null; status?: string | null }>;
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

  return (
    <section className="portal-promo-strip" aria-label="Gdzie oferta jest promowana">
      <p className="portal-promo-strip__kicker">Promocja teraz</p>
      <div className="portal-promo-strip__row">
        {PORTAL_PROMO_STRIP_IDS.map((id: MarketingChannelId) => {
          const on = live.has(id);
          return (
            <div
              key={id}
              className={`portal-promo-chip ${on ? "portal-promo-chip--on" : "portal-promo-chip--off"}`}
            >
              <MarketingChannelBrand id={id} compact inactive={!on} />
              <span className="sr-only">{on ? "aktywna" : "brak publikacji"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
