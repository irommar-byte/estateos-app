import { prisma } from '@/lib/prisma';
import { deliverToClient, emailStep } from '@/lib/crm/clientOutbox';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { buildClientVoice } from '@/lib/crm/clientVoice';

const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);

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
          content: `${voice.chatLead}${text}`,
          activityMetadata: { offerId: offer.id, kind: 'listing_live' },
        },
      },
    ];
    if (portalUrl) {
      steps.push({ kind: 'push', clientId: seller.id, payload: { title: 'Ogłoszenie jest aktywne', body: text.slice(0, 170), tag: `listing-live-${offer.id}`, url: portalUrl } });
    }
    if (seller.email) {
      steps.push(
        emailStep({
          to: seller.email,
          subject: 'Twoje ogłoszenie jest już aktywne',
          replyTo: seller.agencyUser?.email || undefined,
          html: `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:540px;margin:0 auto;padding:24px;color:#15171A">
            <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#0E4D3F">Ogłoszenie aktywne</p>
            <p style="margin:0 0 14px;font-size:15px">${esc(voice.greeting)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${esc(text)}</p>
            <p style="margin:0 0 10px"><a href="${listingUrl}" style="display:inline-block;background:#0E4D3F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Zobacz ogłoszenie</a></p>
            ${portalUrl ? `<p style="margin:0"><a href="${portalUrl}" style="color:#0E4D3F;font-weight:700">Otwórz swój panel</a></p>` : ''}
            <p style="margin:22px 0 0;font-size:13px;color:#5B574F">Pozdrawiam,<br/>${esc(seller.agencyUser?.name || 'Twój agent')}</p></div>`,
        }),
      );
    }
    await deliverToClient({ agencyUserId: seller.agencyUserId, clientId: seller.id, category: 'marketing', source: 'listing_live', approved: true, steps });
    await prisma.agencyClientActivity.create({
      data: { clientId: seller.id, agencyUserId: seller.agencyUserId, kind: 'LISTING_LIVE', title: 'Ogłoszenie aktywne — klient powiadomiony', body: String(offer.id) },
    });
  }
}
