import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildAcquisitionIcs } from '@/lib/agencyClientBusinessCard';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';
import {
  buildAppleClientEmailHtml,
  escapeEmailHtml,
  loadAppleClientEmailIdentity,
} from '@/lib/email/appleClientEmail';

export async function emailClientSchedule(params: {
  clientId: number;
  kind: 'meeting' | 'presentation';
  mode: 'proposed' | 'confirmed' | 'changed';
  startsAt: Date;
  proposedSlots?: Date[];
  location?: string | null;
  notes?: string | null;
  reason?: string | null;
  listingAgentCopy?: boolean;
}): Promise<void> {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, status: 'ACTIVE' },
    select: {
      firstName: true,
      email: true,
      portalToken: true,
      agencyUserId: true,
      agencyUser: { select: { name: true, companyName: true } },
    },
  });
  if (!client?.email) return;

  const identity = await loadAppleClientEmailIdentity(client.agencyUserId);
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';
  const slots = (params.proposedSlots?.length ? params.proposedSlots : [params.startsAt]).filter(Boolean);
  const when = slots.map((slot) => slot.toLocaleString('pl-PL')).join(' · ');
  const noun = params.kind === 'meeting' ? 'spotkania' : 'prezentacji';
  const title =
    params.mode === 'confirmed'
      ? `Potwierdzenie ${noun}`
      : params.mode === 'changed'
        ? `Nowy termin ${noun}`
        : params.listingAgentCopy
          ? 'Prosimy o termin u agenta wystawiającego'
          : `Propozycja ${noun}`;
  const intro = params.listingAgentCopy
    ? `${escapeEmailHtml(identity.agentName)} prosi Cię o wybór godziny. Pokaz uzgadniamy z agentem wystawiającym nieruchomość.`
    : `${escapeEmailHtml(identity.agentName)} ${params.mode === 'confirmed' ? 'potwierdza' : 'przesyła'} termin ${noun}.`;

  const ics = buildAcquisitionIcs({
    title: `${params.kind === 'meeting' ? 'Spotkanie' : 'Prezentacja'} · ${identity.agencyName}`,
    startsAt: params.startsAt,
    location: params.location,
    description: params.notes || params.reason || `${identity.agentName} · ${identity.agencyName}`,
  });

  const highlightHtml =
    params.mode === 'proposed' && slots.length > 0
      ? ''
      : `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
          <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">Termin</p>
          <p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#064e3b;letter-spacing:-0.02em;">${escapeEmailHtml(slots[0]?.toLocaleString('pl-PL') || when)}</p>
          ${params.location ? `<p style="margin:8px 0 0;color:#065f46;">${escapeEmailHtml(params.location)}</p>` : ''}
        </div>`;

  const ctas =
    params.mode === 'proposed' && slots.length > 0
      ? [
          ...slots.map((slot, index) => ({
            label: `Termin ${index + 1}: ${slot.toLocaleString('pl-PL')}`,
            href: portalUrl,
            variant: 'dark' as const,
          })),
          {
            label: 'Zaproponuj inną datę',
            href: portalUrl,
            variant: 'soft' as const,
          },
        ]
      : [
          {
            label: 'Otwórz panel / dodaj do kalendarza',
            href: portalUrl,
            variant: 'primary' as const,
          },
        ];

  const bodyHtml = `
    <p style="margin:0 0 12px;">${intro}</p>
    ${params.reason ? `<p style="margin:0 0 12px;color:#6b7280;">Powód: ${escapeEmailHtml(params.reason)}</p>` : ''}
    ${params.notes && params.mode !== 'confirmed' ? `<p style="margin:0 0 12px;">${escapeEmailHtml(params.notes)}</p>` : ''}
    <p style="margin:0;font-size:13px;color:#6b7280;">W panelu możesz potwierdzić termin albo zaproponować inną godzinę. W załączniku znajdziesz plik kalendarza (.ics).</p>
  `;

  await sendTransactionalEmail({
    to: client.email,
    subject: `${title} · ${when} · ${identity.agencyName}`,
    html: buildAppleClientEmailHtml({
      eyebrow: identity.agencyName,
      title,
      greetingName: client.firstName,
      bodyHtml,
      highlightHtml,
      identity,
      ctas,
      footerNote: 'EstateOS™ · termin prezentacji',
    }),
    attachments: [
      {
        filename: `${params.kind}.ics`,
        content: ics,
        contentType: 'text/calendar; charset=utf-8',
      },
    ],
  }).catch(() => {});

  await sendClientPortalWebPush(params.clientId, {
    title,
    body: `${when}${params.location ? ` · ${params.location}` : ''}`.slice(0, 180),
    tag: `schedule-${params.kind}-${params.clientId}`,
    notificationType: 'client_schedule',
    native: true,
  }).catch(() => {});
}

export async function emailGuestAgencyPresentation(params: {
  to: string;
  visitingAgencyName: string;
  visitorName?: string | null;
  visitorPhone?: string | null;
  hostAgencyName: string;
  agentName: string;
  offerTitle: string;
  offerId: number;
  startsAt: Date;
  location?: string | null;
  notes?: string | null;
  portalUrl?: string | null;
}): Promise<void> {
  const to = String(params.to || '').trim().toLowerCase();
  if (!to.includes('@')) return;
  const when = params.startsAt.toLocaleString('pl-PL');
  const visitor = [params.visitorName, params.visitorPhone].filter(Boolean).join(' · ');
  await sendTransactionalEmail({
    to,
    subject: `Propozycja prezentacji · oferta #${params.offerId} · ${params.hostAgencyName}`,
    html: buildAppleClientEmailHtml({
      eyebrow: params.hostAgencyName,
      title: 'Propozycja prezentacji',
      greetingName: params.visitingAgencyName || 'Państwo',
      bodyHtml: `
        <p style="margin:0 0 12px;">${escapeEmailHtml(params.agentName)} proponuje termin pokazu nieruchomości <strong>#${params.offerId}</strong>${params.offerTitle ? ` — ${escapeEmailHtml(params.offerTitle)}` : ''}.</p>
        ${visitor ? `<p style="margin:0 0 12px;">Gość: ${escapeEmailHtml(visitor)}</p>` : ''}
        ${params.notes ? `<p style="margin:0 0 12px;">${escapeEmailHtml(params.notes)}</p>` : ''}
        <p style="margin:0;font-size:13px;color:#6b7280;">Właściciel dostał tę samą propozycję do akceptacji w panelu klienta.</p>
      `,
      highlightHtml: `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
        <p style="margin:0;font-size:22px;font-weight:900;color:#064e3b;">${escapeEmailHtml(when)}</p>
        ${params.location ? `<p style="margin:8px 0 0;color:#065f46;">${escapeEmailHtml(params.location)}</p>` : ''}
      </div>`,
      identity: {
        agentName: params.agentName,
        agentTitle: 'Agent nieruchomości',
        agencyName: params.hostAgencyName,
        phone: null,
        email: null,
        avatarUrl: null,
        companyLogoUrl: null,
        companyUrl: null,
      },
      ctas: params.portalUrl
        ? [{ label: 'Szczegóły oferty', href: params.portalUrl, variant: 'primary' }]
        : [],
      includeAgentCard: false,
    }),
  }).catch(() => {});
}

export async function emailListingAgentShowingRequest(params: {
  to: string;
  listingAgentName?: string | null;
  requestingAgencyName: string;
  requestingAgentName: string;
  requestingPhone?: string | null;
  buyerFirstName?: string | null;
  offerTitle: string;
  offerId: number;
  slots: Date[];
  notes?: string | null;
  portalUrl?: string | null;
}): Promise<void> {
  const to = String(params.to || '').trim().toLowerCase();
  if (!to.includes('@')) return;
  const when = params.slots.map((slot) => slot.toLocaleString('pl-PL')).join(' · ');
  const requester = [params.requestingAgentName, params.requestingPhone].filter(Boolean).join(' · ');
  await sendTransactionalEmail({
    to,
    subject: `Prośba o pokaz · oferta #${params.offerId} · ${params.requestingAgencyName}`,
    html: buildAppleClientEmailHtml({
      eyebrow: params.requestingAgencyName,
      title: 'Prośba o pokaz nieruchomości',
      greetingName: params.listingAgentName || 'Państwo',
      bodyHtml: `
        <p style="margin:0 0 12px;">${escapeEmailHtml(requester || params.requestingAgentName)} prosi o pokaz oferty <strong>#${params.offerId}</strong>${params.offerTitle ? ` — ${escapeEmailHtml(params.offerTitle)}` : ''}.</p>
        ${params.buyerFirstName ? `<p style="margin:0 0 12px;">Kupujący: ${escapeEmailHtml(params.buyerFirstName)} (klient ${escapeEmailHtml(params.requestingAgencyName)}).</p>` : ''}
        ${params.notes ? `<p style="margin:0 0 12px;">${escapeEmailHtml(params.notes)}</p>` : ''}
        <p style="margin:0;font-size:13px;color:#6b7280;">To prośba od agenta kupującego. Odpowiedz na ten e-mail albo zadzwoń — nie tworzymy drugiego klienta w Twoim CRM.</p>
      `,
      highlightHtml: `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
        <p style="margin:0;font-size:18px;font-weight:900;color:#111827;">${escapeEmailHtml(when || 'Termin do uzgodnienia')}</p>
      </div>`,
      identity: {
        agentName: params.requestingAgentName,
        agentTitle: 'Agent nieruchomości',
        agencyName: params.requestingAgencyName,
        phone: params.requestingPhone || null,
        email: null,
        avatarUrl: null,
        companyLogoUrl: null,
        companyUrl: null,
      },
      ctas: params.portalUrl
        ? [{ label: 'Zobacz ofertę', href: params.portalUrl, variant: 'primary' }]
        : [],
    }),
  }).catch(() => {});
}
