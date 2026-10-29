"use client";

import { ExternalLink } from "lucide-react";
import MarketingChannelBrand from "@/components/portal/MarketingChannelBrand";
import {
  facebookClientOpenHref,
  facebookOpenLabel,
  formatPublicationStatus,
  listingThumbnailFallback,
  promotionGroupLabel,
  resolveMarketingChannel,
} from "@/lib/crm/marketingChannel";
import { usePortalLocale } from "@/components/portal/PortalLocale";

export type ListingPathEvent = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  createdAt: string;
  startsAt?: string | null;
  url?: string | null;
  image?: string | null;
  siteName?: string | null;
  groupName?: string | null;
  groupUrl?: string | null;
  portal?: string | null;
  status?: string | null;
  promotedUntil?: string | null;
  reportId?: number | null;
};

function whenLabel(item: ListingPathEvent, dateLocale: string) {
  const raw = item.startsAt || item.createdAt;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString(dateLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ListingPathEventCard({
  item,
  fallbackImage,
  token,
}: {
  item: ListingPathEvent;
  fallbackImage?: string | null;
  token?: string;
}) {
  const { t, dateLocale } = usePortalLocale();
  const channel = resolveMarketingChannel({
    kind: item.kind,
    portal: item.portal,
    siteName: item.siteName,
    url: item.url,
    groupName: item.groupName,
    groupUrl: item.groupUrl,
    title: item.title,
  });
  const rawStatus = formatPublicationStatus(item.status);
  const status = rawStatus ? t(rawStatus) : null;
  const image = listingThumbnailFallback({
    image: item.image,
    channelId: channel.id,
    listingImage: fallbackImage,
  });
  const isReport = item.kind === "MARKET_REPORT_SENT";
  const headline =
    channel.id === "facebook" && item.groupName && !/^grupa\s+\d{6,}$/i.test(item.groupName) && !/^\d{6,}$/.test(item.groupName)
      ? `Facebook · ${item.groupName}`
      : item.title || channel.label;
  const linkHref = isReport && token
    ? `/klient/${encodeURIComponent(token)}/raport/${item.id}`
    : channel.id === "facebook"
      ? facebookClientOpenHref({ url: item.url, groupUrl: item.groupUrl })
      : item.url || item.groupUrl || null;
  const linkLabel = isReport
    ? t("Otwórz raport")
    : channel.id === "facebook"
      ? t(facebookOpenLabel({ href: linkHref, groupName: null }))
      : `${t("Zobacz publikację")} · ${channel.label}`;

  return (
    <article className={`listing-path-card listing-path-card--${channel.id}`}>
      <div className="listing-path-card__glow" aria-hidden />
      <div className="listing-path-card__row">
        <div className="min-w-0 flex-1">
          <div className="listing-path-card__brand-row">
            <MarketingChannelBrand
              id={channel.id}
              label={t(promotionGroupLabel(channel.id === "system" ? "portal" : channel.id))}
            />
            <p className="listing-path-card__when">{whenLabel(item, dateLocale)}</p>
          </div>
          <p className="listing-path-card__badge">{t(channel.badge)}</p>
          <h3 className="listing-path-card__title">{headline}</h3>
          {item.body ? <p className="listing-path-card__body">{item.body}</p> : null}
          {status ? <p className="listing-path-card__status">{status}</p> : null}
          {item.promotedUntil ? (
            <p className="listing-path-card__goldline">
              {t("Wyróżnienie do {date}", { date: new Date(item.promotedUntil).toLocaleDateString(dateLocale) })}
            </p>
          ) : null}
        </div>
        {image ? (
          <img src={image} alt="" className="listing-path-card__preview" />
        ) : null}
      </div>
      {linkHref ? (
        <a
          href={linkHref}
          target="_blank"
          rel="noreferrer"
          className="listing-path-card__link"
        >
          {linkLabel}
          <ExternalLink className="size-3.5" />
        </a>
      ) : null}
    </article>
  );
}
