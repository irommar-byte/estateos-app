import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/core/notification.core';

export const radarService = {
  async matchNewOffer(offer: any) {
    console.log(`[RADAR] Matching for offer ${offer.id} (${offer.title})`);

    const prefs = await prisma.radarPreference.findMany({
      where: { pushNotifications: true }
    });

    console.log(`[RADAR] Found ${prefs.length} preferences with push enabled`);

    // 🔥 KLUCZ: najlepszy wynik per user
    const bestMatches = new Map<number, { score: number; pref: any }>();

    for (const pref of prefs) {
      try {
        const score = this.calculateScore(pref, offer);

        console.log("[RADAR DEBUG]", {
          user: pref.userId,
          score
        });

        const existing = bestMatches.get(pref.userId);

        if (!existing || score > existing.score) {
          bestMatches.set(pref.userId, { score, pref });
        }

      } catch (e) {
        console.error(`[RADAR ERROR] User ${pref.userId}:`, e);
      }
    }

    let matchCount = 0;

    // 🔥 TERAZ dopiero wysyłamy
    for (const [userId, match] of bestMatches.entries()) {
      const { score } = match;

      if (score < 50) {
        console.log(`[RADAR] ⚪ SKIP user ${userId} score=${score}`);
        continue;
      }

      console.log(`[RADAR] 🟢 FINAL MATCH user ${userId} score=${score}`);

      try {
        await sendNotification({
          userId,
          type: 'RADAR_MATCH',
          title: score >= 85 ? '💎 Idealne trafienie' :
                 score >= 70 ? '🔥 Świeża okazja' :
                               '🎯 Właśnie wpadła',
          body: `${offer.title} • ${offer.price} PLN`,
          targetType: 'OFFER',
          targetId: String(offer.id),
          data: { targetType: 'OFFER', targetId: String(offer.id) },
        });

        matchCount++;

      } catch (e) {
        console.error(`[RADAR SEND ERROR] user ${userId}`, e);
      }
    }

    console.log(`[RADAR] Processed. Total matches sent: ${matchCount}`);
  },

  calculateScore(pref: any, offer: any) {
    let score = 0;

    if (pref.transactionType) {
      if (pref.transactionType === offer.transactionType) score += 20;
      else return 0;
    }

    if (pref.propertyType) {
      if (pref.propertyType === offer.propertyType) score += 10;
      else return 0;
    }

    if (pref.city && offer.city) {
      if (pref.city.toLowerCase() === offer.city.toLowerCase()) score += 30;
      else score -= 10;
    }

    let districts: string[] = [];
    try {
      const raw = typeof pref.districts === "string"
        ? JSON.parse(pref.districts)
        : pref.districts;

      if (Array.isArray(raw)) {
        districts = raw.map((d: any) => String(d).toLowerCase().trim());
      }
    } catch (e) {
      console.error("[RADAR] districts parse error:", e);
    }

    const offerDistrict = offer.district
      ? String(offer.district).toLowerCase().trim()
      : null;

    if (districts.length > 0 && offerDistrict) {
      if (districts.includes(offerDistrict)) score += 20;
      else score -= 5;
    }

    if (pref.maxPrice) {
      if (offer.price <= pref.maxPrice) score += 20;
      else score -= 20;
    }

    if (pref.minArea && offer.area) {
      if (offer.area >= pref.minArea) score += 10;
    }

    if (pref.minYear && offer.yearBuilt) {
      if (offer.yearBuilt >= pref.minYear) score += 5;
    }

    if (pref.requireBalcony && offer.hasBalcony) score += 5;
    if (pref.requireGarden && offer.hasGarden) score += 5;
    if (pref.requireElevator && offer.hasElevator) score += 5;
    if (pref.requireParking && offer.hasParking) score += 5;
    if (pref.requireFurnished && offer.isFurnished) score += 5;

    return score;
  }
};
