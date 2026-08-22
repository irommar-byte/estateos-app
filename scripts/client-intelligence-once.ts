#!/usr/bin/env npx tsx
/**
 * Analiza + opcjonalne wysłanie jednej propozycji EstateOS™ Intelligence.
 * CLIENT_ID=123 SEND=1 ENABLE=1 npx tsx scripts/client-intelligence-once.ts
 */
import { prisma } from '../src/lib/prisma';
import { parseClientOfferFeedback } from '../src/lib/crm/clientPortalFeedback';
import { plainOfferDescription } from '../src/lib/offerDescriptionHtml';
import { pickIntelligenceOffer, sendIntelligenceOffer } from '../src/lib/crm/clientIntelligenceRun';
import { summarizeTaste } from '../src/lib/crm/clientIntelligence';

async function main() {
  const clientId = Number(process.env.CLIENT_ID || process.argv[2] || '123');
  const shouldSend = process.env.SEND === '1';
  const shouldEnable = process.env.ENABLE !== '0';

  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    include: {
      buyerPreference: true,
      matches: {
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              description: true,
              city: true,
              district: true,
              street: true,
              price: true,
              area: true,
              rooms: true,
              hasBalcony: true,
            },
          },
        },
        orderBy: { score: 'desc' },
      },
    },
  });
  if (!client) {
    console.error(JSON.stringify({ ok: false, error: `Brak klienta ${clientId}` }));
    process.exit(1);
  }

  if (shouldEnable) {
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: {
        intelligenceEnabled: true,
        intelligenceIntervalHours: client.intelligenceIntervalHours || 24,
        intelligenceDailyLimit: client.intelligenceDailyLimit || 1,
        intelligenceMinLearns: client.intelligenceMinLearns || 3,
        intelligenceMinScore: client.intelligenceMinScore || 92,
      },
    });
  }

  const { pick, taste } = await pickIntelligenceOffer(clientId, { force: true });
  const reactions = client.matches
    .filter((row) => row.clientFeedback)
    .map((row) => {
      const feedback = parseClientOfferFeedback(row.clientFeedback);
      return {
        offerId: row.offerId,
        title: row.offer.title,
        district: row.offer.district,
        price: row.offer.price,
        notifiedAt: row.notifiedAt,
        sentiment: feedback.sentiment,
        phrases: feedback.phrases,
        liked: feedback.liked,
        disliked: feedback.disliked,
        note: feedback.note,
        excerpt: plainOfferDescription(row.offer.description).slice(0, 220),
      };
    });

  const report = {
    ok: true,
    client: {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`.trim(),
      type: client.type,
      criteria: client.buyerPreference
        ? {
            city: client.buyerPreference.city,
            districts: client.buyerPreference.districts,
            maxPrice: client.buyerPreference.maxPrice,
            minArea: client.buyerPreference.minArea,
            minYear: client.buyerPreference.minYear,
            requireBalcony: client.buyerPreference.requireBalcony,
            requireGarden: client.buyerPreference.requireGarden,
            requireElevator: client.buyerPreference.requireElevator,
            requireParking: client.buyerPreference.requireParking,
            requireFurnished: client.buyerPreference.requireFurnished,
            minMatchThreshold: client.buyerPreference.minMatchThreshold,
          }
        : null,
    },
    taste: {
      summary: summarizeTaste(taste),
      learnCount: taste.learnCount,
      likes: taste.likes,
      maybes: taste.maybes,
      dislikes: taste.dislikes,
      phrases: [...new Set(taste.phrases)],
      dislikedText: taste.dislikedText,
      likedText: taste.likedText,
      rejectedDistricts: [...new Set(taste.rejectedDistricts)],
      likedDistricts: [...new Set(taste.likedDistricts)],
    },
    reactions,
    pick,
  };

  if (shouldSend && pick.ready && pick.offerId) {
    const sent = await sendIntelligenceOffer({ clientId, force: true });
    console.log(JSON.stringify({ ...report, sent }, null, 2));
  } else {
    console.log(JSON.stringify({ ...report, sent: { sent: false, skip: pick.skipReason } }, null, 2));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
