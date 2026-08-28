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

/** Po /szukam: token panelu, włączenie Intelligence i pierwsza propozycja na start. */
export async function bootstrapBuyerIntakePortal(
  clientId: number,
): Promise<BootstrapBuyerIntakePortalResult> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { id: true, portalToken: true, agencyUserId: true, firstName: true, email: true },
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

  let portalToken = client.portalToken;
  if (!portalToken) {
    portalToken = generatePortalToken();
  }

  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      portalToken,
      intelligenceEnabled: true,
    },
  });

  let welcomeEmailSent = false;
  const clientEmail = client.email?.trim();
  let intel = await sendIntelligenceOffer({
    clientId,
    force: true,
    ignoreInterval: true,
    channel: clientEmail ? 'manual' : 'email',
  });

  if (!intel.sent) {
    const topMatch = await prisma.agencyClientMatch.findFirst({
      where: {
        clientId,
        notifiedAt: null,
        score: { gte: 70 },
      },
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
        intelligence: {
          reason: `EstateOS™ Intelligence · dopasowanie ${topMatch.score}%`,
        },
      });
      intel = {
        sent: true,
        pick: { ...intel.pick, offerId: topMatch.offerId, ready: true, skipReason: null },
      };
    }
  }

  if (clientEmail && portalToken) {
    welcomeEmailSent = await sendBuyerIntakePortalWelcomeEmail({
      clientEmail,
      clientFirstName: client.firstName || 'Kliencie',
      agentUserId: client.agencyUserId,
      portalToken,
      intelligenceStarted: intel.sent,
    });
  }

  return {
    portalToken,
    intelligenceSent: intel.sent,
    firstOfferId: intel.pick.offerId,
    intelligenceSkipReason: intel.sent ? null : intel.pick.skipReason,
    welcomeEmailSent,
  };
}
