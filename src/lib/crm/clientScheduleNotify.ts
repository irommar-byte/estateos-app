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

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://estateos.pl'
  ).replace(/\/+$/, '');
}

function mapsUrl(address: string): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

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
  /** Kupujący dostaje bogaty mail (mapa + dowód); sprzedający — krótką notę. */
  audience?: 'buyer' | 'seller' | 'auto';
  offerId?: number | null;
  offerTitle?: string | null;
}): Promise<{ emailed: boolean; to: string | null }> {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, status: 'ACTIVE' },
    select: {
      firstName: true,
      email: true,
      type: true,
      portalToken: true,
      agencyUserId: true,
    },
  });
  if (!client?.email) return { emailed: false, to: null };

  const audience =
    params.audience === 'buyer' || params.audience === 'seller'
      ? params.audience
      : client.type === 'SELLER'
        ? 'seller'
        : 'buyer';

  const identity = await loadAppleClientEmailIdentity(client.agencyUserId);
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : siteBase();
  const slots = (params.proposedSlots?.length ? params.proposedSlots : [params.startsAt]).filter(Boolean);
  const when = slots.map((slot) => slot.toLocaleString('pl-PL')).join(' · ');
  const whenPrimary = slots[0]?.toLocaleString('pl-PL') || when;

  let offerTitle = params.offerTitle || null;
  let address =
    String(params.location || '').trim() ||
    null;
  const offerId = params.offerId || null;
  if (offerId && (!offerTitle || !address)) {
    const offer = await prisma.offer.findFirst({
      where: { id: offerId },
      select: { title: true, street: true, city: true, district: true },
    });
    if (offer) {
      offerTitle = offerTitle || offer.title;
      if (!address) {
        address =
          [offer.street, offer.district, offer.city].filter(Boolean).join(', ') || offer.city || null;
      }
    }
  }

  const noun = params.kind === 'meeting' ? 'spotkania' : 'prezentacji';
  const offerUrl = offerId ? `${siteBase()}/oferta/${offerId}` : null;

  // —— Sprzedający: krótka nota ——
  if (audience === 'seller' && params.kind === 'presentation') {
    const title =
      params.mode === 'confirmed'
        ? 'Pokaz u Twojej nieruchomości — potwierdzony'
        : params.mode === 'changed'
          ? 'Zmiana terminu pokazu'
          : 'Propozycja pokazu u Twojej nieruchomości';
    await sendTransactionalEmail({
      to: client.email,
      subject: `${title} · ${whenPrimary} · ${identity.agencyName}`,
      html: buildAppleClientEmailHtml({
        eyebrow: identity.agencyName,
        title,
        greetingName: client.firstName,
        bodyHtml: `
          <p style="margin:0 0 12px;">${escapeEmailHtml(identity.agentName)} ${
            params.mode === 'confirmed' ? 'potwierdza' : 'informuje o'
          } terminie pokazu${offerTitle ? ` oferty <strong>${escapeEmailHtml(offerTitle)}</strong>` : ''}.</p>
          ${address ? `<p style="margin:0 0 12px;">Adres: ${escapeEmailHtml(address)}</p>` : ''}
          <p style="margin:0;font-size:13px;color:#6b7280;">To informacja dla właściciela — nie musisz nic potwierdzać. Szczegóły w panelu.</p>
        `,
        highlightHtml: `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#111827;">${escapeEmailHtml(whenPrimary)}</p>
        </div>`,
        identity,
        ctas: [{ label: 'Otwórz panel', href: portalUrl, variant: 'primary' }],
        footerNote: 'EstateOS™ · pokaz u Twojej nieruchomości',
      }),
    }).catch(() => {});
    await sendClientPortalWebPush(params.clientId, {
      title,
      body: whenPrimary.slice(0, 180),
      tag: `schedule-seller-${params.clientId}`,
      notificationType: 'client_schedule',
      native: true,
    }).catch(() => {});
    return { emailed: true, to: client.email };
  }

  // —— Kupujący / spotkanie ——
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
    : params.mode === 'confirmed' && params.kind === 'presentation'
      ? `${escapeEmailHtml(identity.agentName)} potwierdza termin oglądania. Wszystko jest ustalone — szczegóły poniżej.`
      : `${escapeEmailHtml(identity.agentName)} ${params.mode === 'confirmed' ? 'potwierdza' : 'przesyła'} termin ${noun}.`;

  const ics = buildAcquisitionIcs({
    title: `${params.kind === 'meeting' ? 'Spotkanie' : 'Prezentacja'} · ${identity.agencyName}`,
    startsAt: params.startsAt,
    location: address || params.location,
    description: params.notes || params.reason || `${identity.agentName} · ${identity.agencyName}`,
  });

  const mapBlock =
    address && params.mode === 'confirmed' && params.kind === 'presentation'
      ? `<p style="margin:12px 0 0;"><a href="${escapeEmailHtml(mapsUrl(address))}" style="color:#047857;font-weight:700;text-decoration:none;">Otwórz mapę · ${escapeEmailHtml(address)}</a></p>`
      : address
        ? `<p style="margin:8px 0 0;color:#065f46;">${escapeEmailHtml(address)}</p>`
        : '';

  const highlightHtml =
    params.mode === 'proposed' && slots.length > 0
      ? ''
      : `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
          <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">Termin</p>
          <p style="margin:8px 0 0;font-size:22px;font-weight:900;color:#064e3b;letter-spacing:-0.02em;">${escapeEmailHtml(whenPrimary)}</p>
          ${offerTitle ? `<p style="margin:10px 0 0;font-weight:700;color:#064e3b;">${escapeEmailHtml(offerTitle)}</p>` : ''}
          ${mapBlock}
        </div>`;

  const idCardNote =
    params.mode === 'confirmed' && params.kind === 'presentation'
      ? `<div style="margin:18px 0;padding:16px 18px;border-radius:18px;background:#fff7ed;border:1px solid #fed7aa;">
          <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;">Prosimy zabrać</p>
          <p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:#9a3412;font-weight:700;">Dowód tożsamości</p>
          <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#9a3412;">Na miejscu potwierdzimy obecność na oglądaniu (dokument potwierdzenia — nie umowa pośrednictwa).</p>
        </div>`
      : '';

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
          ...(offerUrl
            ? [{ label: 'Zobacz ofertę', href: offerUrl, variant: 'dark' as const }]
            : []),
        ];

  const bodyHtml =
    params.mode === 'confirmed' && params.kind === 'presentation'
      ? `
    <p style="margin:0 0 12px;">${intro}</p>
    <p style="margin:0 0 12px;">Termin jest u Ciebie, u agenta w CRM i w załączniku kalendarza (.ics).</p>
    ${idCardNote}
    <p style="margin:0;font-size:13px;color:#6b7280;">Do zobaczenia na miejscu. W razie problemów z dojazdem napisz w panelu — agent dostanie powiadomienie od razu.</p>
  `
      : `
    <p style="margin:0 0 12px;">${intro}</p>
    ${params.reason ? `<p style="margin:0 0 12px;color:#6b7280;">Powód: ${escapeEmailHtml(params.reason)}</p>` : ''}
    ${params.notes && params.mode !== 'confirmed' ? `<p style="margin:0 0 12px;">${escapeEmailHtml(params.notes)}</p>` : ''}
    <p style="margin:0;font-size:13px;color:#6b7280;">W panelu możesz potwierdzić termin albo zaproponować inną godzinę. W załączniku znajdziesz plik kalendarza (.ics).</p>
  `;

  await sendTransactionalEmail({
    to: client.email,
    subject: `${title} · ${whenPrimary} · ${identity.agencyName}`,
    html: buildAppleClientEmailHtml({
      eyebrow: identity.agencyName,
      title,
      greetingName: client.firstName,
      bodyHtml,
      highlightHtml,
      identity,
      ctas,
      footerNote:
        params.mode === 'confirmed' && params.kind === 'presentation'
          ? 'EstateOS™ · potwierdzenie oglądania'
          : 'EstateOS™ · termin prezentacji',
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
    body: `${whenPrimary}${address ? ` · ${address}` : ''}`.slice(0, 180),
    tag: `schedule-${params.kind}-${params.clientId}`,
    notificationType: 'client_schedule',
    native: true,
  }).catch(() => {});

  return { emailed: true, to: client.email };
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
  const offerHref = params.offerId ? `${siteBase()}/oferta/${params.offerId}` : params.portalUrl;
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
      ctas: offerHref
        ? [{ label: 'Zobacz ofertę', href: offerHref, variant: 'primary' }]
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
  const offerHref = params.offerId ? `${siteBase()}/oferta/${params.offerId}` : params.portalUrl;
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
      ctas: offerHref
        ? [{ label: 'Zobacz ofertę', href: offerHref, variant: 'primary' }]
        : [],
    }),
  }).catch(() => {});
}
