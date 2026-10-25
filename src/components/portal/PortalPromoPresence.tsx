"use client";

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import MarketingChannelBrand from "@/components/portal/MarketingChannelBrand";
import {
  livePromotionChannelIds,
  PORTAL_PROMO_STRIP_IDS,
  promotionGroupId,
  promotionGroupLabel,
  type MarketingChannelId,
} from "@/lib/crm/marketingChannel";
import type { ListingPathEvent } from "@/components/portal/ListingPathEventCard";

function AgenciesGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M4.5 19.5V8.2L12 3.8l7.5 4.4v11.3h-5.1v-6.2h-4.8v6.2H4.5Z" />
    </svg>
  );
}

const shortDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) : null;
};

const plGroups = (n: number) =>
  n === 1 ? "1 grupa" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? `${n} grupy` : `${n} grup`;

type Tile = {
  id: MarketingChannelId;
  on: boolean;
  since: string | null;
  count: number;
  href: string | null;
};

/**
 * Gdzie ogłoszenie jest widoczne — wyłącznie na podstawie zapisanych publikacji.
 * Aktywny portal: pełny kafelek w kolorze marki, data i link. Nieaktywny: cichy obrys „jeszcze nie”.
 */
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
  activeChannels?: Array<{ portal?: string | null; status?: string | null; externalUrl?: string | null }>;
  otherAgencies?: { live?: boolean; body?: string | null } | null;
}) {
  const tiles = useMemo<Tile[]>(() => {
    const live = livePromotionChannelIds({ listing, listingPath, activeChannels });
    const firstSeen = new Map<MarketingChannelId, string>();
    for (const item of listingPath || []) {
      const id = promotionGroupId({ ...item, url: item.url, createdAt: item.createdAt });
      const prev = firstSeen.get(id);
      if (!prev || item.createdAt < prev) firstSeen.set(id, item.createdAt);
    }
    const byChannel = new Map<MarketingChannelId, { count: number; href: string | null }>();
    for (const ch of activeChannels || []) {
      const label = String(ch.portal || "");
      const id = PORTAL_PROMO_STRIP_IDS.find((pid) => promotionGroupLabel(pid) === label);
      if (!id) continue;
      const row = byChannel.get(id) || { count: 0, href: null };
      row.count += 1;
      row.href = row.href || ch.externalUrl || null;
      byChannel.set(id, row);
    }
    return PORTAL_PROMO_STRIP_IDS.map((id) => {
      const on = live.has(id);
      const ch = byChannel.get(id);
      const href = id === "estateos" ? (listing?.id ? `/oferta/${listing.id}` : null) : ch?.href || null;
      return {
        id,
        on,
        since: on ? (id === "estateos" ? listing?.createdAt || firstSeen.get(id) || null : firstSeen.get(id) || null) : null,
        count: ch?.count || (on ? 1 : 0),
        href: on ? href : null,
      };
    }).sort((a, b) => Number(b.on) - Number(a.on));
  }, [listing, listingPath, activeChannels]);

  const activeCount = tiles.filter((t) => t.on).length;
  const agenciesOn = Boolean(otherAgencies?.live);
  const agenciesBody = String(otherAgencies?.body || "").trim();

  return (
    <section className="promo-board" aria-label="Gdzie ogłoszenie jest widoczne">
      <div className="promo-board__head">
        <p className="promo-board__title">
          {activeCount
            ? `Ogłoszenie widać na ${activeCount} z ${tiles.length} portali`
            : "Ogłoszenie jeszcze nie jest opublikowane na portalach"}
        </p>
        <p className="promo-board__sub">Pokazujemy tylko publikacje zapisane przez agenta. Dotknij portalu, aby zobaczyć ogłoszenie.</p>
      </div>
      <ul className="promo-board__grid">
        {tiles.map((tile) => {
          const since = shortDate(tile.since);
          const detail = tile.on
            ? [since ? `od ${since}` : "aktywne", tile.id === "facebook" && tile.count > 1 ? plGroups(tile.count) : null]
                .filter(Boolean)
                .join(", ")
            : "jeszcze nie";
          const inner = (
            <>
              <MarketingChannelBrand id={tile.id} inactive={!tile.on} />
              <span className="promo-tile__status">
                {tile.on ? <span className="promo-tile__dot" aria-hidden /> : null}
                {detail}
              </span>
              {tile.href ? <ArrowUpRight className="promo-tile__go" aria-hidden /> : null}
            </>
          );
          return (
            <li key={tile.id}>
              {tile.href ? (
                <a
                  href={tile.href}
                  target={tile.href.startsWith("/") ? undefined : "_blank"}
                  rel="noreferrer"
                  className={`promo-tile promo-tile--${tile.id} promo-tile--on`}
                  aria-label={`${promotionGroupLabel(tile.id)}: ${detail}. Otwórz ogłoszenie`}
                >
                  {inner}
                </a>
              ) : (
                <div className={`promo-tile promo-tile--${tile.id} ${tile.on ? "promo-tile--on" : "promo-tile--off"}`}>{inner}</div>
              )}
            </li>
          );
        })}
        {agenciesOn ? (
          <li>
            <div className="promo-tile promo-tile--agencies promo-tile--on">
              <span className="marketing-channel-brand">
                <span className="marketing-channel-brand__mark promo-tile__agencies-mark" aria-hidden>
                  <AgenciesGlyph />
                </span>
                <span className="marketing-channel-brand__word">Inne biura</span>
              </span>
              <span className="promo-tile__status">
                <span className="promo-tile__dot" aria-hidden />
                współpraca
              </span>
            </div>
          </li>
        ) : null}
      </ul>
      {agenciesOn && agenciesBody ? <p className="promo-board__note">{agenciesBody}</p> : null}
    </section>
  );
}
