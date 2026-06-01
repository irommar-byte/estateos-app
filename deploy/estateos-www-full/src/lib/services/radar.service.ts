import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { calculateRadarMatchScore, radarMatchThreshold } from '@/lib/radarMatchScore';

export type RadarMatchContext = {
  /** Id bieżącej sesji publikacji — każde wejście na rynek = nowy push. */
  publicationId?: number | string | bigint | null;
};

const RADAR_COORD_RETRY_MS = [0, 3_000, 12_000] as const;

function radarIdempotencyKey(
  offerId: number,
  userId: number,
  publicationId?: number | string | bigint | null,
): string {
  const pub = publicationId != null && String(publicationId).trim() !== '' ? String(publicationId) : 'legacy';
  return `radar_match:offer:${offerId}:pub:${pub}:user:${userId}`;
}

function hasOfferCoordinates(offer: Record<string, unknown>): boolean {
  const lat = Number(offer.lat ?? offer.latitude);
  const lng = Number(offer.lng ?? offer.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function scheduleRadarCoordRetry(offerId: number, publicationId?: number | string | bigint | null, attempt = 1) {
  if (attempt >= RADAR_COORD_RETRY_MS.length) return;
  const delayMs = RADAR_COORD_RETRY_MS[attempt];
  setTimeout(() => {
    void radarService.notifyRadarForMarketEntry(offerId, publicationId, attempt).catch((err) => {
      console.warn(`[RADAR] coord retry ${attempt} failed offer=${offerId}`, err);
    });
  }, delayMs);
}

export const radarService = {
  async matchNewOffer(offer: Record<string, unknown>, context: RadarMatchContext = {}) {
    const offerId = Number(offer.id);
    const ownerId = Number(offer.userId);
    const publicationId = context.publicationId ?? null;
    console.log(`[RADAR] Matching for offer ${offerId} (${offer.title}) pub=${publicationId ?? 'n/a'}`);

    const prefs = await prisma.radarPreference.findMany({
      where: { pushNotifications: true },
    });

    console.log(`[RADAR] Found ${prefs.length} preferences with push enabled`);

    const sendTasks: Array<Promise<void>> = [];
    let matchCount = 0;

    for (const pref of prefs) {
      const userId = Number(pref.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      if (Number.isFinite(ownerId) && ownerId > 0 && userId === ownerId) continue;

      const score = calculateRadarMatchScore(pref, offer);
      const threshold = radarMatchThreshold(pref);

      if (score < threshold) {
        console.log(`[RADAR] ⚪ SKIP user ${userId} score=${score} threshold=${threshold}`);
        continue;
      }

      console.log(`[RADAR] 🟢 FINAL MATCH user ${userId} score=${score}`);
      matchCount += 1;

      sendTasks.push(
        sendNotification({
          userId,
          type: 'RADAR_MATCH',
          title:
            score >= 85 ? '💎 Idealne trafienie' : score >= 70 ? '🔥 Świeża okazja' : '🎯 Właśnie wpadła',
          body: `${offer.title} • ${getCanonicalOfferPricePln(offer).toLocaleString('pl-PL')} PLN`,
          data: {
            targetType: 'OFFER',
            targetId: String(offerId),
            offerId,
            notificationType: 'radar_match',
            screen: 'OfferDetail',
            route: 'OfferDetail',
            deeplink: `estateos://offer/${offerId}`,
          },
          idempotencyKey: radarIdempotencyKey(offerId, userId, publicationId),
        }).then(() => undefined),
      );
    }

    await Promise.allSettled(sendTasks);
    console.log(`[RADAR] Processed. Total matches queued: ${matchCount}`);
  },

  async notifyRadarForMarketEntry(
    offerId: number,
    publicationId?: number | string | bigint | null,
    coordRetryAttempt = 0,
  ) {
    const fullOffer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!fullOffer || String(fullOffer.status).toUpperCase() !== 'ACTIVE') {
      console.log(`[RADAR] skip offer=${offerId} — not ACTIVE`);
      return;
    }

    const offerRecord = fullOffer as Record<string, unknown>;
    if (!hasOfferCoordinates(offerRecord)) {
      if (coordRetryAttempt < RADAR_COORD_RETRY_MS.length - 1) {
        console.log(
          `[RADAR] offer=${offerId} bez współrzędnych — ponowienie za ${RADAR_COORD_RETRY_MS[coordRetryAttempt + 1]}ms`,
        );
        scheduleRadarCoordRetry(offerId, publicationId, coordRetryAttempt + 1);
        return;
      }
      console.warn(`[RADAR] offer=${offerId} nadal bez współrzędnych — matching bez mapy (tylko miasto/dzielnica)`);
    }

    await this.matchNewOffer(offerRecord, { publicationId });
  },
};

/** Wywołanie po publikacji — nie blokuje odpowiedzi HTTP. */
export function dispatchRadarForMarketEntry(
  offerId: number,
  publicationId?: number | string | bigint | null,
): void {
  void radarService.notifyRadarForMarketEntry(offerId, publicationId).catch((err) => {
    console.warn('[RADAR] post-activation match failed', err);
  });
}
