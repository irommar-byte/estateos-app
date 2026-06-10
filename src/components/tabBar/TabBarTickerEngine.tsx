import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useOpenHouseLiveStore } from '../../store/useOpenHouseLiveStore';
import { useTabBarTickerStore } from '../../store/useTabBarTickerStore';
import { fetchLiveAuctionEvents, fetchAuctionTicker } from '../../services/auctionService';
import { fetchOpenHouseTicker } from '../../services/openHouseService';
import { fetchWebOffersArray } from '../../utils/webOffersFallback';
import { useI18n } from '../../i18n';
import {
  buildAuctionBidFromEvent,
  buildAuctionBidMessage,
  buildAuctionLiveFromEvent,
  buildAuctionLiveMessage,
  buildInfoPool,
  buildNewOfferMessage,
  buildOpenHouseNewMessage,
  buildOpenHouseUrgentMessage,
  buildPriceDropMessage,
  detectPriceDrop,
  hoursUntil,
  NEW_OFFER_WINDOW_MS,
  offerPublishedMs,
  snapshotOfferPrice,
  type OfferPriceSnapshot,
  URGENT_OPEN_HOUSE_HOURS,
} from '../../utils/tabBarTickerMessages';

const POLL_MS = 30_000;

/** Źródło komunikatów: oferty, przeceny, licytacje, open house. */
export default function TabBarTickerEngine() {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const reservedIds = useOpenHouseLiveStore((s) => s.reservedEventIds);
  const enqueue = useTabBarTickerStore((s) => s.enqueue);
  const setInfoPool = useTabBarTickerStore((s) => s.setInfoPool);

  const knownOfferIds = useRef<Set<number>>(new Set());
  const offerPrices = useRef<Map<number, OfferPriceSnapshot>>(new Map());
  const knownOhIds = useRef<Set<number>>(new Set());
  const knownAucIds = useRef<Set<number>>(new Set());
  const aucBidState = useRef<Map<number, { bidCount: number; currentPrice: number }>>(new Map());
  const urgentOhShown = useRef<Set<number>>(new Set());
  const seeded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const [offers, ohItems, aucTicker, aucLive] = await Promise.all([
        fetchWebOffersArray().catch(() => []),
        fetchOpenHouseTicker(token).catch(() => []),
        fetchAuctionTicker(token).catch(() => []),
        fetchLiveAuctionEvents(token).catch(() => []),
      ]);
      if (cancelled) return;

      const reservedSet = new Set(reservedIds);
      const now = Date.now();

      const seedAuction = (eventId: number, bidCount: number, currentPrice: number) => {
        aucBidState.current.set(eventId, { bidCount, currentPrice });
      };

      if (!seeded.current) {
        for (const raw of offers) {
          const id = Number(raw?.id || 0);
          if (id) {
            knownOfferIds.current.add(id);
            offerPrices.current.set(id, snapshotOfferPrice(raw));
          }
        }
        for (const oh of ohItems) knownOhIds.current.add(oh.eventId);
        for (const a of aucTicker) {
          knownAucIds.current.add(a.eventId);
          seedAuction(a.eventId, a.bidCount ?? 0, a.currentPrice);
        }
        for (const ev of aucLive) {
          knownAucIds.current.add(ev.id);
          seedAuction(ev.id, ev.bidCount, ev.currentPrice || ev.startPrice);
        }
        seeded.current = true;
        setInfoPool(
          buildInfoPool(t, {
            openHouseCount: ohItems.length,
            auctionCount: Math.max(aucTicker.length, aucLive.length),
          }),
        );
        return;
      }

      setInfoPool(
        buildInfoPool(t, {
          openHouseCount: ohItems.length,
          auctionCount: Math.max(aucTicker.length, aucLive.length),
        }),
      );

      for (const raw of offers) {
        const id = Number(raw?.id || 0);
        if (!id) continue;

        const snap = snapshotOfferPrice(raw);
        const prev = offerPrices.current.get(id);

        if (!knownOfferIds.current.has(id)) {
          knownOfferIds.current.add(id);
          const age = now - offerPublishedMs(raw);
          if (age >= 0 && age <= NEW_OFFER_WINDOW_MS) {
            enqueue(buildNewOfferMessage(t, raw));
          }
        } else if (prev && detectPriceDrop(prev, snap)) {
          enqueue(buildPriceDropMessage(t, raw));
        }

        offerPrices.current.set(id, snap);
      }

      for (const oh of ohItems) {
        if (!knownOhIds.current.has(oh.eventId)) {
          knownOhIds.current.add(oh.eventId);
          enqueue(buildOpenHouseNewMessage(t, oh));
        }

        const h = hoursUntil(oh.startsAt);
        if (
          h != null &&
          h <= URGENT_OPEN_HOUSE_HOURS &&
          oh.spotsLeft > 0 &&
          !reservedSet.has(oh.eventId) &&
          !urgentOhShown.current.has(oh.eventId)
        ) {
          urgentOhShown.current.add(oh.eventId);
          enqueue(buildOpenHouseUrgentMessage(t, oh, h));
        }
      }

      const trackAuction = (eventId: number, bidCount: number, currentPrice: number, msg: () => void) => {
        const prev = aucBidState.current.get(eventId);
        aucBidState.current.set(eventId, { bidCount, currentPrice });
        if (prev && bidCount > prev.bidCount) msg();
      };

      for (const a of aucTicker) {
        if (!knownAucIds.current.has(a.eventId)) {
          knownAucIds.current.add(a.eventId);
          seedAuction(a.eventId, a.bidCount ?? 0, a.currentPrice);
          enqueue(buildAuctionLiveMessage(t, a));
        } else {
          trackAuction(a.eventId, a.bidCount ?? 0, a.currentPrice, () => {
            enqueue(buildAuctionBidMessage(t, a, a.bidCount ?? 0));
          });
        }
      }

      for (const ev of aucLive) {
        if (!knownAucIds.current.has(ev.id)) {
          knownAucIds.current.add(ev.id);
          seedAuction(ev.id, ev.bidCount, ev.currentPrice || ev.startPrice);
          const synthetic = aucTicker.find((x) => x.eventId === ev.id);
          enqueue(
            synthetic ? buildAuctionLiveMessage(t, synthetic) : buildAuctionLiveFromEvent(t, ev),
          );
        } else {
          trackAuction(ev.id, ev.bidCount, ev.currentPrice || ev.startPrice, () => {
            const synthetic = aucTicker.find((x) => x.eventId === ev.id);
            enqueue(
              synthetic
                ? buildAuctionBidMessage(t, synthetic, ev.bidCount)
                : buildAuctionBidFromEvent(t, ev),
            );
          });
        }
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, reservedIds, enqueue, setInfoPool, t]);

  return null;
}
