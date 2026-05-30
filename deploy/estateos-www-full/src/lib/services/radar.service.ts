import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';
import { getCanonicalOfferPricePln } from '@/lib/money/offerPrice';
import { calculateRadarMatchScore, radarMatchThreshold } from '@/lib/radarMatchScore';

export const radarService = {
  async matchNewOffer(offer: Record<string, unknown>) {
    const offerId = Number(offer.id);
    const ownerId = Number(offer.userId);
    console.log(`[RADAR] Matching for offer ${offerId} (${offer.title})`);

    const prefs = await prisma.radarPreference.findMany({
      where: { pushNotifications: true },
    });

    console.log(`[RADAR] Found ${prefs.length} preferences with push enabled`);

    let matchCount = 0;

    for (const pref of prefs) {
      const userId = Number(pref.userId);
      if (!Number.isFinite(userId) || userId <= 0) continue;
      if (Number.isFinite(ownerId) && ownerId > 0 && userId === ownerId) continue;

      try {
        const score = calculateRadarMatchScore(pref, offer);
        const threshold = radarMatchThreshold(pref);

        console.log('[RADAR DEBUG]', { user: userId, score, threshold });

        if (score < threshold) {
          console.log(`[RADAR] ⚪ SKIP user ${userId} score=${score} threshold=${threshold}`);
          continue;
        }

        console.log(`[RADAR] 🟢 FINAL MATCH user ${userId} score=${score}`);

        await sendNotification({
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
          idempotencyKey: `radar_match:offer:${offerId}:user:${userId}`,
        });

        matchCount++;
      } catch (e) {
        console.error(`[RADAR ERROR] User ${pref.userId}:`, e);
      }
    }

    console.log(`[RADAR] Processed. Total matches sent: ${matchCount}`);
  },
};
