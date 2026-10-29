import { prisma } from '@/lib/prisma';
import { generatePortalToken, notifyAgencyClientAboutOffer } from '@/lib/agencyClientNotify';
import { sendIntelligenceOffer } from '@/lib/crm/clientIntelligenceRun';
import { sendBuyerIntakePortalWelcomeEmail } from '@/lib/buyerIntakePortalWelcomeEmail';

export type BootstrapBuyerIntakePortalResult = {
  portalToken: string | null;
  intelligenceSent: boolean;
  firstOfferId: number | null;
  intelligenceSkipReason: string | null;
  welcomeEmailSent: boolean;
};

/**
 * Po /szukam: token panelu i mail powitalny. Z ogólnego formularza pierwsza propozycja idzie od razu
 * (Intelligence włączone); z osobistego linku agenta decyzję zostawiamy agentowi — dostaje powiadomienie
 * z gotowymi dopasowaniami i sam wysyła ofertę albo włącza automatyczne propozycje.
 */
export async function bootstrapBuyerIntakePortal(
  clientId: number,
  options: { autoFirstOffer: boolean },
): Promise<BootstrapBuyerIntakePortalResult> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { id: true, portalToken: true, agencyUserId: true, email: true },
  });

  if (!client) {
    return {
      portalToken: null,
      intelligenceSent: false,
      firstOfferId: null,
      intelligenceSkipReason: 'Brak klienta.',
      welcomeEmailSent: false,
    };
  }

  const portalToken = client.portalToken || generatePortalToken();
  await prisma.agencyClient.update({
    where: { id: clientId },
    data: { portalToken, ...(options.autoFirstOffer ? { intelligenceEnabled: true } : {}) },
  });

  let intelligenceSent = false;
  let firstOfferId: number | null = null;
  let intelligenceSkipReason: string | null = options.autoFirstOffer ? null : 'Agent wybiera pierwszą ofertę.';

  if (options.autoFirstOffer) {
    const intel = await sendIntelligenceOffer({
      clientId,
      force: true,
      ignoreInterval: true,
      channel: client.email?.trim() ? 'manual' : 'email',
    });
    intelligenceSent = intel.sent;
    firstOfferId = intel.pick.offerId;
    intelligenceSkipReason = intel.sent ? null : intel.pick.skipReason;

    if (!intel.sent) {
      const topMatch = await prisma.agencyClientMatch.findFirst({
        where: { clientId, notifiedAt: null, score: { gte: 70 } },
        orderBy: { score: 'desc' },
        select: { offerId: true, score: true },
      });
      if (topMatch) {
        await notifyAgencyClientAboutOffer({
          clientId,
          offerId: topMatch.offerId,
          agencyUserId: client.agencyUserId,
          channel: 'manual',
          customMessage: `Pierwsza propozycja pod Twoje kryteria — dopasowanie ${topMatch.score}%.`,
          intelligence: { reason: `EstateOS™ Intelligence · dopasowanie ${topMatch.score}%` },
        });
        intelligenceSent = true;
        firstOfferId = topMatch.offerId;
        intelligenceSkipReason = null;
      }
    }
  }

  const welcomeEmailSent = client.email?.trim()
    ? await sendBuyerIntakePortalWelcomeEmail({ clientId, firstOfferReady: intelligenceSent })
    : false;

  return { portalToken, intelligenceSent, firstOfferId, intelligenceSkipReason, welcomeEmailSent };
}
