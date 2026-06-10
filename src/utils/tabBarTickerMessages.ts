import type { AuctionEventRecord } from '../contracts/auctionContract';
import type { AuctionTickerItem } from '../contracts/auctionContract';
import type { OpenHouseTickerItem } from '../contracts/openHouseContract';
import type { TabBarTickerMessage } from '../contracts/tabBarTickerContract';
import { formatAmountWithCurrency } from '../money/format';
import { normalizeListingCurrency } from '../money/convert';
import { resolveOfferPriceDiscount } from './offerPriceDiscount';

const DOT = ' · ';

type TFn = (key: string, params?: Record<string, string | number>) => string;

function loc(city?: string | null, district?: string | null) {
  return [city, district].filter(Boolean).join(' · ');
}

function line(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(DOT);
}

function withCta(body: string, cta: string): Pick<TabBarTickerMessage, 'bodyText' | 'ctaLabel'> {
  return { bodyText: body, ctaLabel: cta };
}

function scrollSpeed(text: string) {
  const len = Math.max(text.length, 48);
  return Math.max(26, Math.min(44, 920 / len));
}

function attachScroll(
  msg: TabBarTickerMessage,
): TabBarTickerMessage {
  return { ...msg, scrollPxPerSec: scrollSpeed(msg.bodyText) };
}

function msg(
  base: Omit<TabBarTickerMessage, 'scrollPxPerSec'>,
): TabBarTickerMessage {
  return attachScroll(base as TabBarTickerMessage);
}

function offerTitle(raw: Record<string, unknown>): string {
  const title = String(raw.title || raw.name || '').trim();
  if (title) return title;
  const type = String(raw.propertyTypeLabel || raw.propertyType || '').trim();
  return type || 'Nieruchomość';
}

function formatOfferPrice(raw: Record<string, unknown>): string {
  const price = Number(raw.pricePln ?? raw.price ?? 0);
  const currency = normalizeListingCurrency(String(raw.priceCurrency || 'PLN'));
  if (!Number.isFinite(price) || price <= 0) return '';
  return formatAmountWithCurrency(Math.round(price), currency);
}

export function buildNewOfferMessage(t: TFn, raw: Record<string, unknown>): TabBarTickerMessage {
  const id = Number(raw.id || 0);
  const place = loc(String(raw.city || ''), String(raw.district || raw.area || ''));
  const body = line(t('tabs.ticker.newPropertyHead'), offerTitle(raw), place);
  return msg({
    id: `offer-new-${id}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaCheck')),
    action: { type: 'offer', offerId: id },
  });
}

export function buildPriceDropMessage(t: TFn, raw: Record<string, unknown>): TabBarTickerMessage {
  const id = Number(raw.id || 0);
  const meta = resolveOfferPriceDiscount(raw);
  const place = loc(String(raw.city || ''), String(raw.district || raw.area || ''));
  const price = formatOfferPrice(raw);
  const body = line(
    t('tabs.ticker.priceDropHead'),
    offerTitle(raw),
    place,
    t('tabs.ticker.priceDropDetail', {
      percent: meta.discountPercent,
      price,
    }),
  );
  const priceKey = Number(raw.pricePln ?? raw.price ?? 0);
  return msg({
    id: `offer-drop-${id}-${Math.round(priceKey)}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaViewOffer')),
    action: { type: 'offer', offerId: id },
  });
}

export function buildOpenHouseNewMessage(t: TFn, item: OpenHouseTickerItem): TabBarTickerMessage {
  const place = loc(item.city, item.district);
  const body = line(t('tabs.ticker.openHouseHead'), item.title, place);
  return msg({
    id: `oh-new-${item.eventId}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaReserve')),
    action: { type: 'open_house', eventId: item.eventId, offerId: item.offerId },
  });
}

export function buildOpenHouseUrgentMessage(
  t: TFn,
  item: OpenHouseTickerItem,
  hoursLeft: number,
): TabBarTickerMessage {
  const place = loc(item.city, item.district);
  const timeLabel =
    hoursLeft < 1
      ? t('tabs.ticker.lessThanHour')
      : t('tabs.ticker.hoursLeft', { n: Math.max(1, Math.round(hoursLeft)) });
  const body = line(
    t('tabs.ticker.hurryHead', { time: timeLabel }),
    item.title,
    place,
    t('tabs.ticker.spotsLeftShort', { n: item.spotsLeft }),
  );
  return msg({
    id: `oh-urgent-${item.eventId}-${Math.round(hoursLeft * 10)}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaSignUpNow')),
    action: { type: 'open_house', eventId: item.eventId, offerId: item.offerId },
  });
}

export function buildAuctionLiveMessage(t: TFn, item: AuctionTickerItem): TabBarTickerMessage {
  const place = loc(item.city, item.district);
  const price = formatAmountWithCurrency(
    Math.round(item.currentPrice),
    normalizeListingCurrency(item.currency),
  );
  const body = line(
    t('tabs.ticker.auctionHead'),
    item.title || place,
    place,
    t('tabs.ticker.auctionPriceNow', { price }),
  );
  return msg({
    id: `auc-live-${item.eventId}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaOutbid')),
    action: { type: 'auction', eventId: item.eventId, offerId: item.offerId },
  });
}

export function buildAuctionLiveFromEvent(t: TFn, ev: AuctionEventRecord): TabBarTickerMessage {
  const place = loc(ev.offer.city, ev.offer.district);
  const price = formatAmountWithCurrency(
    Math.round(ev.currentPrice || ev.startPrice),
    normalizeListingCurrency(ev.currency),
  );
  const body = line(
    t('tabs.ticker.auctionHead'),
    ev.title || ev.offer.title,
    place,
    t('tabs.ticker.auctionPriceNow', { price }),
  );
  return msg({
    id: `auc-live-${ev.id}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaOutbid')),
    action: { type: 'auction', eventId: ev.id, offerId: ev.offerId },
  });
}

export function buildAuctionBidMessage(
  t: TFn,
  item: AuctionTickerItem,
  bidCount: number,
): TabBarTickerMessage {
  const place = loc(item.city, item.district);
  const price = formatAmountWithCurrency(
    Math.round(item.currentPrice),
    normalizeListingCurrency(item.currency),
  );
  const body = line(
    t('tabs.ticker.auctionBidHead'),
    item.title || place,
    place,
    t('tabs.ticker.auctionBidDetail', { price, bids: bidCount }),
  );
  return msg({
    id: `auc-bid-${item.eventId}-${bidCount}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaOutbid')),
    action: { type: 'auction', eventId: item.eventId, offerId: item.offerId },
  });
}

export function buildAuctionBidFromEvent(
  t: TFn,
  ev: AuctionEventRecord,
): TabBarTickerMessage {
  const place = loc(ev.offer.city, ev.offer.district);
  const price = formatAmountWithCurrency(
    Math.round(ev.currentPrice || ev.startPrice),
    normalizeListingCurrency(ev.currency),
  );
  const body = line(
    t('tabs.ticker.auctionBidHead'),
    ev.title || ev.offer.title,
    place,
    t('tabs.ticker.auctionBidDetail', { price, bids: ev.bidCount }),
  );
  return msg({
    id: `auc-bid-${ev.id}-${ev.bidCount}`,
    priority: 'immediate',
    ...withCta(body, t('tabs.ticker.ctaOutbid')),
    action: { type: 'auction', eventId: ev.id, offerId: ev.offerId },
  });
}

export function buildInfoPool(
  t: TFn,
  stats: { openHouseCount: number; auctionCount: number },
): TabBarTickerMessage[] {
  const pool: TabBarTickerMessage[] = [
    msg({
      id: 'info-live-panel',
      priority: 'info',
      ...withCta(t('tabs.ticker.infoLiveHint'), t('tabs.ticker.ctaOpenLive')),
      action: { type: 'live_panel' },
    }),
    msg({
      id: 'info-radar',
      priority: 'info',
      ...withCta(t('tabs.ticker.infoRadar'), t('tabs.ticker.ctaCheck')),
      action: { type: 'live_panel' },
    }),
  ];
  if (stats.openHouseCount > 0) {
    pool.push(
      msg({
        id: 'info-open-house-count',
        priority: 'info',
        ...withCta(
          t('tabs.ticker.infoOpenHouseCount', { n: stats.openHouseCount }),
          t('tabs.ticker.ctaReserve'),
        ),
        action: { type: 'live_panel' },
      }),
    );
  }
  if (stats.auctionCount > 0) {
    pool.push(
      msg({
        id: 'info-auction-count',
        priority: 'info',
        ...withCta(
          t('tabs.ticker.infoAuctionCount', { n: stats.auctionCount }),
          t('tabs.ticker.ctaOutbid'),
        ),
        action: { type: 'live_panel' },
      }),
    );
  }
  pool.push(
    msg({
      id: 'info-test',
      priority: 'info',
      ...withCta(t('tabs.liveTickerTest'), t('tabs.ticker.ctaOpenLive')),
      action: { type: 'live_panel' },
    }),
  );
  return pool;
}

export function hoursUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / (60 * 60 * 1000);
}

export function offerPublishedMs(raw: Record<string, unknown>): number {
  const v =
    raw.publishedAt ||
    raw.published_at ||
    raw.createdAt ||
    raw.created_at ||
    raw.updatedAt ||
    raw.updated_at;
  const ms = v ? new Date(String(v)).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

export function offerPricePln(raw: Record<string, unknown>): number {
  const n = Number(raw.pricePln ?? raw.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type OfferPriceSnapshot = {
  pricePln: number;
  isDiscounted: boolean;
  discountPercent: number;
};

export function snapshotOfferPrice(raw: Record<string, unknown>): OfferPriceSnapshot {
  const meta = resolveOfferPriceDiscount(raw);
  return {
    pricePln: offerPricePln(raw),
    isDiscounted: meta.isDiscounted,
    discountPercent: meta.discountPercent,
  };
}

export function detectPriceDrop(prev: OfferPriceSnapshot, next: OfferPriceSnapshot): boolean {
  if (next.isDiscounted && !prev.isDiscounted) return true;
  if (next.isDiscounted && next.discountPercent > prev.discountPercent + 0) return true;
  if (next.pricePln > 0 && prev.pricePln > 0 && next.pricePln < prev.pricePln - 500) return true;
  return false;
}

export const NEW_OFFER_WINDOW_MS = 15 * 60 * 1000;
export const URGENT_OPEN_HOUSE_HOURS = 1;
