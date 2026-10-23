import { prisma } from '@/lib/prisma';
import { buildClientVoice } from '@/lib/crm/clientVoice';
import { formatMeetingWhenPl } from '@/lib/datetime/warsaw';
import { deliverToClient, emailStep } from '@/lib/crm/clientOutbox';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { buildAcquisitionIcs } from '@/lib/agencyClientBusinessCard';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import {
  buildAppleClientEmailHtml,
  escapeEmailHtml,
  loadAppleClientEmailIdentity,
} from '@/lib/email/appleClientEmail';
import { stripEmailHtml, type ClientOutboundPreview } from '@/lib/crm/outboundPreview';
import { formatVisitAddress } from '@/lib/crm/visitPrepPacket';

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

type ScheduleMailParams = {
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
  /** Agent właśnie zobaczył i zatwierdził podgląd tej wiadomości. */
  approved?: boolean;
};

async function composeClientScheduleMail(params: ScheduleMailParams) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, status: 'ACTIVE' },
    select: {
      id: true,
      firstName: true,
      salutation: true,
      email: true,
      type: true,
      portalToken: true,
      agencyUserId: true,
    },
  });
  if (!client?.email) return null;

  const audience =
    params.audience === 'buyer' || params.audience === 'seller'
      ? params.audience
      : client.type === 'SELLER'
        ? 'seller'
        : 'buyer';

  const identity = await loadAppleClientEmailIdentity(client.agencyUserId);
  const voice = buildClientVoice({
    clientId: client.id,
    firstName: client.firstName,
    salutation: client.salutation,
    agentName: identity.agentName,
  });
  const { a, c } = voice;
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : siteBase();
  const slots = (params.proposedSlots?.length ? params.proposedSlots : [params.startsAt]).filter(Boolean);
  const when = slots.map((slot) => formatMeetingWhenPl(slot)).join(' · ');
  const whenPrimary = slots[0] ? formatMeetingWhenPl(slots[0]) : when;
  const saltKey = `${params.kind}:${params.mode}:${params.startsAt.toISOString()}`;

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
  address = formatVisitAddress(address) || address;

  const noun = params.kind === 'meeting' ? 'spotkania' : 'oglądania';
  const offerUrl = offerId ? `${siteBase()}/oferta/${offerId}` : null;

  // —— Sprzedający: krótka nota ——
  if (audience === 'seller' && params.kind === 'presentation') {
    const title =
      params.mode === 'confirmed'
        ? 'Pokaz potwierdzony'
        : params.mode === 'changed'
          ? 'Zmiana terminu pokazu'
          : 'Planowany pokaz nieruchomości';
    const subject =
      params.mode === 'confirmed'
        ? `Pokaz potwierdzony — ${whenPrimary}`
        : params.mode === 'changed'
          ? `Nowy termin pokazu — ${whenPrimary}`
          : `Pokaz nieruchomości — ${whenPrimary}`;
    const sellerLead =
      params.mode === 'confirmed'
        ? voice.pick('seller-show-confirmed', [
            `Potwierdzam pokaz${offerTitle ? ` nieruchomości <strong>${escapeEmailHtml(offerTitle)}</strong>` : ''} — kupujący jest umówiony.`,
            `Mamy umówiony pokaz${offerTitle ? ` nieruchomości <strong>${escapeEmailHtml(offerTitle)}</strong>` : ''}. Wszystko jest potwierdzone.`,
          ], saltKey)
        : params.mode === 'changed'
          ? `Termin pokazu${offerTitle ? ` nieruchomości <strong>${escapeEmailHtml(offerTitle)}</strong>` : ''} się zmienił — nowy termin jest poniżej.`
          : `Umawiam pokaz${offerTitle ? ` nieruchomości <strong>${escapeEmailHtml(offerTitle)}</strong>` : ''} z zainteresowanym kupującym.`;
    const html = buildAppleClientEmailHtml({
      eyebrow: identity.agencyName,
      title,
      greetingName: client.firstName,
      voice,
      bodyHtml: `
          <p style="margin:0 0 12px;">${sellerLead}</p>
          ${address ? `<p style="margin:0 0 12px;">Adres: ${escapeEmailHtml(address)}</p>` : ''}
          <p style="margin:0;font-size:13px;color:#6b7280;">${c('Nie musi Pani niczego potwierdzać', 'Nie musi Pan niczego potwierdzać', 'Nie trzeba niczego potwierdzać')} — daję znać, żeby wszystko było jasne. Po pokazie dam znać, jak poszło.</p>
        `,
      highlightHtml: `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#f8fafc;border:1px solid #e5e7eb;">
          <p style="margin:0;font-size:20px;font-weight:900;color:#111827;">${escapeEmailHtml(whenPrimary)}</p>
        </div>`,
      identity,
      ctas: [{ label: 'Otwórz panel', href: portalUrl, variant: 'primary' }],
    });
    const preview: ClientOutboundPreview = {
      kind: 'schedule',
      to: client.email,
      subject,
      bodyPreview: stripEmailHtml(html),
      smsBody: null,
      html,
      channels: ['email', 'portal'],
    };
    return {
      audience: 'seller' as const,
      client,
      identity,
      title,
      subject,
      html,
      ics: null as string | null,
      whenPrimary,
      address,
      preview,
      pushBody: whenPrimary.slice(0, 180),
    };
  }

  // —— Kupujący / spotkanie ——
  const isShowing = params.kind === 'presentation';
  const title =
    params.mode === 'confirmed'
      ? isShowing ? 'Do zobaczenia na oglądaniu' : 'Spotkanie potwierdzone'
      : params.mode === 'changed'
        ? isShowing ? 'Nowy termin oglądania' : 'Nowy termin spotkania'
        : params.listingAgentCopy
          ? 'Proszę o wybór godziny'
          : isShowing ? 'Termin oglądania do wyboru' : 'Propozycja spotkania';

  const offerBit = offerTitle ? ` <strong>${escapeEmailHtml(offerTitle)}</strong>` : '';
  const intro = params.listingAgentCopy
    ? `Ustalam pokaz${offerBit} z agentem, który prowadzi tę nieruchomość. Proszę wybrać godzinę, która najbardziej pasuje — resztę uzgodnię po swojej stronie.`
    : params.mode === 'confirmed' && isShowing
      ? voice.pick('buyer-show-confirmed', [
          `Potwierdzam oglądanie${offerBit}. Wszystko jest ustalone — poniżej termin i adres.`,
          `Mamy to — oglądanie${offerBit} jest potwierdzone. Do zobaczenia na miejscu.`,
          `Oglądanie${offerBit} jest umówione. Cieszę się, że ${c('Pani je zobaczy', 'Pan je zobaczy', 'możemy je zobaczyć')}.`,
        ], saltKey)
      : params.mode === 'confirmed'
        ? `Potwierdzam nasze spotkanie. Termin i miejsce są poniżej.`
        : params.mode === 'changed'
          ? `Termin ${noun}${offerBit} się zmienił — nowy jest poniżej. Jeśli ${c('Pani nie pasuje', 'Panu nie pasuje', 'nie pasuje')}, proszę dać znać.`
          : isShowing
            ? voice.pick('buyer-show-proposed', [
                `${a('Przygotowałem', 'Przygotowałam')} ${slots.length > 1 ? 'kilka terminów' : 'termin'} oglądania${offerBit}. ${slots.length > 1 ? 'Wystarczy kliknąć ten, który najbardziej pasuje.' : 'Jeśli pasuje — wystarczy jedno kliknięcie.'}`,
                `Proponuję ${slots.length > 1 ? 'kilka terminów' : 'termin'} oglądania${offerBit}. ${slots.length > 1 ? 'Proszę wybrać najwygodniejszy' : 'Proszę dać znać, czy pasuje'} — a jeśli żaden nie odpowiada, chętnie dopasuję się do innego.`,
              ], saltKey)
            : `Proponuję termin spotkania. Jeśli ${c('Pani nie pasuje', 'Panu nie pasuje', 'nie pasuje')}, proszę zaproponować inny — dopasuję się.`;

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
          <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#c2410c;">Proszę zabrać</p>
          <p style="margin:8px 0 0;font-size:15px;line-height:1.55;color:#9a3412;font-weight:700;">Dowód osobisty</p>
          <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#9a3412;">Na miejscu podpiszemy krótkie potwierdzenie oglądania — to nie jest umowa pośrednictwa, tylko standardowy dokument z wizyty.</p>
        </div>`
      : '';

  const ctas =
    params.mode === 'proposed' && slots.length > 0
      ? [
          ...slots.map((slot) => ({
            label: formatMeetingWhenPl(slot),
            href: `${portalUrl}${portalUrl.includes('?') ? '&' : '?'}pickSlot=${encodeURIComponent(slot.toISOString())}`,
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
            label: 'Szczegóły i kalendarz',
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
    <p style="margin:0 0 12px;">W załączniku jest plik do kalendarza — jednym kliknięciem termin trafi do telefonu.</p>
    ${idCardNote}
    <p style="margin:0;font-size:13px;color:#6b7280;">${voice.pick('buyer-show-ps', [
      `Gdyby coś się zmieniło albo pojawił się problem z dojazdem, proszę dać znać — telefonicznie albo w panelu.`,
      `Jeśli coś wypadnie, proszę po prostu napisać albo zadzwonić — przełożymy bez problemu.`,
    ], saltKey)}</p>
  `
      : `
    <p style="margin:0 0 12px;">${intro}</p>
    ${params.reason ? `<p style="margin:0 0 12px;color:#6b7280;">${escapeEmailHtml(params.reason)}</p>` : ''}
    ${params.notes && params.mode !== 'confirmed' ? `<p style="margin:0 0 12px;">${escapeEmailHtml(params.notes)}</p>` : ''}
    <p style="margin:0;font-size:13px;color:#6b7280;">${params.mode === 'proposed' ? 'Termin można potwierdzić jednym kliknięciem albo zaproponować inny. ' : ''}W załączniku jest plik do kalendarza.</p>
  `;

  const subject =
    params.mode === 'confirmed'
      ? `${isShowing ? 'Oglądanie potwierdzone' : 'Spotkanie potwierdzone'} — ${whenPrimary}`
      : params.mode === 'changed'
        ? `${isShowing ? 'Nowy termin oglądania' : 'Nowy termin spotkania'} — ${whenPrimary}`
        : isShowing
          ? `${slots.length > 1 ? 'Terminy oglądania do wyboru' : 'Termin oglądania'}${offerTitle ? ` — ${offerTitle}` : ''}`
          : `Propozycja spotkania — ${whenPrimary}`;
  const html = buildAppleClientEmailHtml({
    eyebrow: identity.agencyName,
    title,
    greetingName: client.firstName,
    voice,
    bodyHtml,
    highlightHtml,
    identity,
    ctas,
  });

  const plainSlots = slots.map((slot) => formatMeetingWhenPl(slot)).join('\n');
  const bodyPreview = [
    `Do: ${client.email}`,
    title,
    offerTitle ? `Oferta: ${offerTitle}` : null,
    address ? `Adres: ${address}` : null,
    params.mode === 'proposed' ? `Proponowane terminy:\n${plainSlots}` : `Termin: ${whenPrimary}`,
    params.mode === 'confirmed' && params.kind === 'presentation' ? 'Prosimy zabrać dowód tożsamości.' : null,
    `Panel: ${portalUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const preview: ClientOutboundPreview = {
    kind: 'schedule',
    to: client.email,
    subject,
    bodyPreview,
    smsBody: null,
    html,
    channels: ['email', 'portal'],
  };

  return {
    audience: 'buyer' as const,
    client,
    identity,
    title,
    subject,
    html,
    ics,
    whenPrimary,
    address,
    preview,
    pushBody: `${whenPrimary}${address ? ` · ${address}` : ''}`.slice(0, 180),
  };
}

export async function previewClientSchedule(
  params: ScheduleMailParams,
): Promise<{ ok: true; preview: ClientOutboundPreview } | { ok: false; error: string }> {
  const composed = await composeClientScheduleMail(params);
  if (!composed) return { ok: false, error: 'Klient nie ma adresu e-mail.' };
  return { ok: true, preview: composed.preview };
}

export async function emailClientSchedule(
  params: ScheduleMailParams,
): Promise<{ emailed: boolean; queued?: boolean; outboxId?: number | null; to: string | null; preview?: ClientOutboundPreview }> {
  const composed = await composeClientScheduleMail(params);
  if (!composed) return { emailed: false, to: null };

  const delivery = await deliverToClient({
    agencyUserId: composed.client.agencyUserId,
    clientId: params.clientId,
    category: 'schedule',
    source: `schedule_${params.kind}_${params.mode}`,
    approved: params.approved,
    steps: [
      emailStep({
        to: composed.client.email!,
        subject: composed.subject,
        html: composed.html,
        attachments: composed.ics
          ? [
              {
                filename: `${params.kind}.ics`,
                content: composed.ics,
                contentType: 'text/calendar; charset=utf-8',
              },
            ]
          : undefined,
      }),
      {
        kind: 'push',
        clientId: params.clientId,
        payload: {
          title: composed.title,
          body: composed.pushBody,
          tag:
            composed.audience === 'seller'
              ? `schedule-seller-${params.clientId}`
              : `schedule-${params.kind}-${params.clientId}`,
          notificationType: 'client_schedule',
          native: true,
        },
      },
    ],
  });

  return {
    emailed: delivery.emailSent,
    queued: delivery.queued,
    outboxId: delivery.outboxId,
    to: composed.client.email,
    preview: composed.preview,
  };
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
  const when = formatMeetingWhenPl(params.startsAt);
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
  const when = params.slots.map((slot) => formatMeetingWhenPl(slot)).join(' · ');
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
