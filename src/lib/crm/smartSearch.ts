import { prisma } from '@/lib/prisma';
import { buildClientMessageEmailHtml } from '@/lib/crm/clientMessageEmail';
import { logTeamEvent } from '@/lib/crm/teamLog';
import { getSmartAgentAccess } from '@/lib/crm/smartAgent';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { loadAppleClientEmailIdentity } from '@/lib/email/appleClientEmail';

/**
 * Wyszukiwarka /szukam w imieniu agenta ze Smart Agent OS™:
 * osobisty link /szukam/a/{id} — kupujący wypełnia formularz z twarzą agenta,
 * trafia od razu do jego klientów, a Smart Agent sam dopasowuje i wysyła mu oferty.
 */
export const SMART_SEARCH_LEAD_KIND = 'SMART_SEARCH_LEAD';

function siteOrigin(): string {
  return String(process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl').replace(/\/$/, '');
}

export function smartSearchUrl(userId: number): string {
  return `${siteOrigin()}/szukam/a/${userId}`;
}

export async function smartSearchSummary(userId: number) {
  const where = { agencyUserId: userId, kind: SMART_SEARCH_LEAD_KIND };
  const [leads, last] = await Promise.all([
    prisma.agencyClientActivity.count({ where }),
    prisma.agencyClientActivity.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  return { url: smartSearchUrl(userId), qrUrl: `/szukam/a/${userId}/qr`, leads, lastLeadAt: last?.createdAt.toISOString() ?? null };
}

/** Zapis po formularzu z linku agenta: ślad na karcie klienta i w dzienniku zespołu. */
export async function recordSmartSearchLead(params: { agentUserId: number; clientId: number; name: string; reused: boolean; city: string | null }) {
  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agentUserId,
      kind: SMART_SEARCH_LEAD_KIND,
      title: params.reused ? 'Wrócił przez Twoją wyszukiwarkę' : 'Przyszedł z Twojej wyszukiwarki',
      body: params.city ? `Szuka: ${params.city}` : null,
    },
  });
  await logTeamEvent({
    userId: params.agentUserId,
    kind: SMART_SEARCH_LEAD_KIND,
    title: `${params.reused ? 'Kupujący wrócił przez wyszukiwarkę' : 'Nowy kupujący z wyszukiwarki'}: ${params.name}`,
    body: params.city ? `Szuka: ${params.city}` : null,
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Zaproszenie e-mailem w imieniu agenta — tylko przy aktywnym Smart Agent OS™. */
export async function sendSmartSearchInvite(params: { userId: number; email: string; name?: string | null }) {
  const access = await getSmartAgentAccess(params.userId);
  if (!access.active) throw new Error('Wyszukiwarka w Twoim imieniu działa przy aktywnym Smart Agent OS™.');
  const email = String(params.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error('Podaj poprawny adres e-mail.');
  const firstName = String(params.name || '').trim().split(/\s+/)[0]?.slice(0, 60) || null;

  const [identity, agent] = await Promise.all([
    loadAppleClientEmailIdentity(params.userId),
    prisma.user.findUnique({ where: { id: params.userId }, select: { email: true } }),
  ]);
  const agentFirst = (identity.agentName || '').split(/\s+/)[0] || 'Twój agent';
  const url = smartSearchUrl(params.userId);
  const html = await buildClientMessageEmailHtml({
    agencyUserId: params.userId,
    client: { id: 0, firstName, salutation: null },
    eyebrow: 'Wyszukiwanie nieruchomości',
    title: 'Znajdę dla Ciebie nieruchomość',
    paragraphs: [
      'Opisz w dwie minuty, czego szukasz — lokalizację, budżet i to, co jest dla Ciebie ważne.',
      'Od tej chwili szukam dla Ciebie na całym rynku. Dopasowane oferty trafią do Twojego panelu, a Ty oceniasz je jednym dotknięciem.',
    ],
    bullets: ['oferty dopasowane do Twoich kryteriów, także te spoza portali,', 'oglądania umawiane w Twoim terminie,', 'negocjacje i dokumenty w jednym miejscu.'],
    closing: 'Dla kupujących usługa jest bezpłatna.',
    ctas: [{ label: 'Opisz, czego szukasz', href: url }],
  });
  const sent = await sendTransactionalEmail({
    to: email,
    subject: `${agentFirst} — znajdę dla Ciebie nieruchomość`,
    html,
    replyTo: agent?.email || undefined,
  });
  if (!sent) throw new Error('Nie udało się wysłać wiadomości. Spróbuj ponownie.');
  await logTeamEvent({ userId: params.userId, kind: 'SMART_SEARCH_INVITE', title: `Wysłał wyszukiwarkę: ${email}` });
}
