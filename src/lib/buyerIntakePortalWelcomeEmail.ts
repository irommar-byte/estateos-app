import { prisma } from '@/lib/prisma';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { buildClientMessageEmailHtml, type ClientEmailFact } from '@/lib/crm/clientMessageEmail';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { loadAppleClientEmailIdentity } from '@/lib/email/appleClientEmail';

const PROPERTY_LABEL: Record<string, string> = { FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' };

function formatPln(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

/**
 * Powitanie po formularzu /szukam — w tym samym szablonie co cała poczta do klientów:
 * co zapisaliśmy, co będzie dalej i że cała współpraca dzieje się w panelu klienta.
 */
export async function sendBuyerIntakePortalWelcomeEmail(params: {
  clientId: number;
  firstOfferReady: boolean;
}): Promise<boolean> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: params.clientId },
    select: {
      id: true,
      agencyUserId: true,
      firstName: true,
      salutation: true,
      email: true,
      portalToken: true,
      agencyUser: { select: { email: true } },
      buyerPreference: {
        select: { city: true, districts: true, maxPrice: true, minArea: true, propertyType: true, transactionType: true },
      },
    },
  });
  const email = client?.email?.trim().toLowerCase();
  if (!client || !email || !client.portalToken) return false;

  const identity = await loadAppleClientEmailIdentity(client.agencyUserId);
  const agentFirst = (identity.agentName || '').split(/\s+/)[0] || 'Twój agent';
  const pref = client.buyerPreference;
  const facts: ClientEmailFact[] = pref
    ? [
        { label: 'Szukasz', value: [PROPERTY_LABEL[String(pref.propertyType)] || null, pref.transactionType === 'RENT' ? 'wynajem' : 'kupno'].filter(Boolean).join(' · ') },
        {
          label: 'Lokalizacja',
          value: [pref.city, Array.isArray(pref.districts) ? (pref.districts as unknown[]).map(String).slice(0, 3).join(', ') : null]
            .filter(Boolean)
            .join(' · '),
        },
        { label: pref.transactionType === 'RENT' ? 'Czynsz do' : 'Budżet do', value: formatPln(pref.maxPrice) || '' },
        { label: 'Metraż od', value: pref.minArea ? `${pref.minArea} m²` : '' },
      ].filter((fact) => fact.value)
    : [];

  const portalUrl = buildPortalUrl(client.portalToken);
  const html = await buildClientMessageEmailHtml({
    agencyUserId: client.agencyUserId,
    client,
    eyebrow: 'Twój panel klienta',
    title: params.firstOfferReady ? 'Pierwsza propozycja już czeka' : 'Zaczynamy szukać',
    paragraphs: [
      `Dziękuję za wypełnienie formularza — mam wszystko, czego potrzebuję, żeby zacząć. ${
        params.firstOfferReady
          ? 'Pierwsza dopasowana oferta czeka już w Twoim panelu.'
          : 'Przejrzę dopasowane oferty i wyślę Ci pierwsze propozycje do panelu.'
      }`,
      'Cała nasza współpraca odbywa się w Twoim panelu klienta:',
    ],
    bullets: [
      'oferty dopasowane do Twoich kryteriów — oceniasz je jednym dotknięciem,',
      'terminy oglądań, które potwierdzasz albo zmieniasz,',
      'negocjacje, dokumenty i czat ze mną w jednym miejscu.',
    ],
    closing: 'Link do panelu jest stały — warto go zachować. Dla kupujących usługa jest bezpłatna.',
    facts,
    ctas: [{ label: 'Otwórz swój panel', href: portalUrl }],
  });

  return sendTransactionalEmail({
    to: email,
    subject: params.firstOfferReady ? 'Pierwsza propozycja czeka w Twoim panelu' : `${agentFirst} zaczyna szukać dla Ciebie — Twój panel klienta`,
    html,
    replyTo: client.agencyUser?.email || undefined,
  });
}
