import { prisma } from '@/lib/prisma';
import { deliverToClient, emailStep } from '@/lib/crm/clientOutbox';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { buildClientVoice, withChatLead } from '@/lib/crm/clientVoice';
import { buildClientMessageEmailHtml } from '@/lib/crm/clientMessageEmail';

/**
 * Ogłoszenie właśnie stało się aktywne — sprzedający dostaje powiadomienie, e-mail i wiadomość w panelu.
 * Aktywacja to decyzja agenta, więc wysyłka idzie od razu. Każde ogłoszenie powiadamia tylko raz.
 */
export async function notifySellerListingLive(offerId: number): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { id: true, title: true, status: true } });
  if (!offer || offer.status !== 'ACTIVE') return;
  const sellers = await prisma.agencyClient.findMany({
    where: { linkedOfferId: offerId, type: 'SELLER', status: 'ACTIVE' },
    select: {
      id: true,
      agencyUserId: true,
      firstName: true,
      salutation: true,
      email: true,
      portalToken: true,
      linkedUserId: true,
      agencyUser: { select: { name: true, email: true } },
    },
  });
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/$/, '');
  const listingUrl = `${base}/oferta/${offer.id}`;

  for (const seller of sellers) {
    const already = await prisma.agencyClientActivity.findFirst({
      where: { clientId: seller.id, kind: 'LISTING_LIVE', body: String(offer.id) },
      select: { id: true },
    });
    if (already) continue;

    const voice = buildClientVoice({ clientId: seller.id, firstName: seller.firstName, salutation: seller.salutation, agentName: seller.agencyUser?.name });
    const portalUrl = seller.portalToken ? buildPortalUrl(seller.portalToken) : null;
    const text = 'Ogłoszenie Twojej nieruchomości jest już aktywne — kupujący je widzą. Możesz je otworzyć w panelu, tam też zobaczysz zainteresowanie i terminy oglądań.';
    const steps: Parameters<typeof deliverToClient>[0]['steps'] = [
      {
        kind: 'chat',
        params: {
          clientId: seller.id,
          agencyUserId: seller.agencyUserId,
          linkedUserId: seller.linkedUserId,
          from: 'agent',
          content: withChatLead(voice, text),
          activityMetadata: { offerId: offer.id, kind: 'listing_live' },
        },
      },
    ];
    if (portalUrl) {
      steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Ogłoszenie jest aktywne', body: text.slice(0, 170), tag: `listing-live-${offer.id}`, url: portalUrl } });
    }
    if (seller.email) {
      const html = await buildClientMessageEmailHtml({
        agencyUserId: seller.agencyUserId,
        client: seller,
        eyebrow: 'Ogłoszenie aktywne',
        title: 'Twoje ogłoszenie jest już widoczne',
        paragraphs: [
          'Ogłoszenie Twojej nieruchomości jest aktywne — kupujący mogą je oglądać i umawiać się na prezentacje.',
          'W panelu na bieżąco zobaczysz zainteresowanie, terminy oglądań i oferty kupujących.',
        ],
        property: { title: offer.title || `Oferta #${offer.id}` },
        ctas: [
          { label: 'Zobacz ogłoszenie', href: listingUrl },
          ...(portalUrl ? [{ label: 'Otwórz swój panel', href: portalUrl, variant: 'soft' as const }] : []),
        ],
      });
      steps.push(emailStep({ to: seller.email, subject: 'Twoje ogłoszenie jest już aktywne', replyTo: seller.agencyUser?.email || undefined, html }));
    }
    await deliverToClient({ agencyUserId: seller.agencyUserId, clientId: seller.id, category: 'marketing', source: 'listing_live', approved: true, steps });
    await prisma.agencyClientActivity.create({
      data: { clientId: seller.id, agencyUserId: seller.agencyUserId, kind: 'LISTING_LIVE', title: 'Ogłoszenie aktywne — klient powiadomiony', body: String(offer.id) },
    });
  }
}
