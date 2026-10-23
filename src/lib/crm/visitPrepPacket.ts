import { prisma } from '@/lib/prisma';
import { buildClientVoice } from '@/lib/crm/clientVoice';
import { deliverToClient, emailStep } from '@/lib/crm/clientOutbox';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import {
  buildAppleClientEmailHtml,
  escapeEmailHtml,
  loadAppleClientEmailIdentity,
} from '@/lib/email/appleClientEmail';
import { stripEmailHtml, type ClientOutboundPreview } from '@/lib/crm/outboundPreview';

/** Skróć adres do czytelnej formy (bez „województwo…, Polska” i duplikatów miasta). */
export function formatVisitAddress(raw: string | null | undefined): string {
  const text = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const parts = text
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => {
      const lower = p.toLowerCase();
      if (lower === 'polska' || lower === 'poland') return false;
      if (lower.startsWith('województwo') || lower.startsWith('woj.')) return false;
      return true;
    });
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(', ');
}

async function buildVisitPrepPacket(params: {
  agencyUserId: number;
  clientId: number;
  parkingNote?: string | null;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    include: {
      activities: {
        where: {
          kind: {
            in: [
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION_HELD,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!client) return { ok: false as const, status: 404, error: 'Nie znaleziono klienta.' };
  const slot = resolvePresentation(client.activities);
  if (!slot) return { ok: false as const, status: 400, error: 'Brak umówionej prezentacji.' };
  if (slot.heldAt) return { ok: false as const, status: 400, error: 'Prezentacja już się odbyła.' };

  const offerId = slot.offerId;
  const offer = offerId
    ? await prisma.offer.findFirst({
        where: { id: offerId },
        select: { id: true, title: true, street: true, city: true, district: true, lat: true, lng: true },
      })
    : null;

  const identity = await loadAppleClientEmailIdentity(params.agencyUserId);
  const voice = buildClientVoice({
    clientId: client.id,
    firstName: client.firstName,
    salutation: client.salutation,
    agentName: identity.agentName,
  });

  const when = new Date(slot.startsAt);
  const whenLabel = when.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const whenShort = when.toLocaleString('pl-PL', {
    timeZone: 'Europe/Warsaw',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const fromOffer = [offer?.street, offer?.district, offer?.city].filter(Boolean).join(', ');
  const address =
    formatVisitAddress(fromOffer) ||
    formatVisitAddress(slot.location) ||
    offer?.title ||
    'adres u agenta';

  const mapUrl =
    offer?.lat != null && offer?.lng != null
      ? `https://maps.apple.com/?ll=${offer.lat},${offer.lng}&q=${encodeURIComponent(address)}`
      : `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';

  const parkingCustom = String(params.parkingNote || '').trim();
  const salt = `${slot.startsAt}`;
  const intro = voice.pick('visit-prep-intro', [
    'Przypominam o naszym oglądaniu. Poniżej termin, adres i mapa — żeby dojazd był jak najprostszy.',
    'Do zobaczenia już niedługo! Poniżej wszystko, czego potrzeba: termin, adres i mapa dojazdu.',
    'Krótko przed oglądaniem przesyłam najważniejsze informacje — termin, adres i mapę.',
  ], salt);
  const onSite = voice.pick('visit-prep-onsite', [
    'Będę czekać na miejscu. Gdyby coś się zmieniło, proszę zadzwonić albo napisać — przełożymy bez problemu.',
    'Gdyby coś wypadło albo był problem z dojazdem, proszę po prostu dać znać — telefonicznie albo w panelu.',
  ], salt);
  const agentFirst = voice.agentFirstName || identity.agentName;
  const smsHello = voice.vocative ? `Dzień dobry, ${voice.vocative}!` : 'Dzień dobry!';

  const sms = `${smsHello} Przypominam o oglądaniu: ${whenShort}, ${address}. Mapa i szczegóły: ${portalUrl} Do zobaczenia, ${agentFirst}`;
  const subject = `Przypomnienie: oglądanie ${whenShort}`;
  const plainBody = `${voice.greeting}\n\n${intro}\n\n${whenLabel}\n${offer?.title || ''}\n${address}\nMapa: ${mapUrl}\nPanel: ${portalUrl}\n\n${onSite}\n\n${identity.agentName}`;

  const emailHtml = buildAppleClientEmailHtml({
    eyebrow: identity.agencyName,
    title: 'Do zobaczenia na oglądaniu',
    greetingName: client.firstName,
    voice,
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeEmailHtml(intro)}</p>
      <p style="margin:0 0 12px;">${escapeEmailHtml(onSite)}</p>
      ${
        parkingCustom
          ? `<p style="margin:0;font-size:13px;color:#6b7280;">Parking: ${escapeEmailHtml(parkingCustom)}</p>`
          : ''
      }
    `,
    highlightHtml: `<div style="margin:18px 0;padding:18px 20px;border-radius:18px;background:#ecfdf5;border:1px solid #a7f3d0;">
      <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">Termin</p>
      <p style="margin:8px 0 0;font-size:20px;font-weight:900;color:#064e3b;">${escapeEmailHtml(whenLabel)}</p>
      ${offer?.title ? `<p style="margin:10px 0 0;font-weight:700;color:#064e3b;">${escapeEmailHtml(offer.title)}</p>` : ''}
      <p style="margin:10px 0 0;color:#065f46;">${escapeEmailHtml(address)}</p>
      <p style="margin:10px 0 0;"><a href="${escapeEmailHtml(mapUrl)}" style="color:#047857;font-weight:700;text-decoration:none;">Otwórz mapę</a></p>
    </div>`,
    identity,
    ctas: [{ label: 'Szczegóły w panelu', href: portalUrl, variant: 'primary' }],
  });

  const preview: ClientOutboundPreview = {
    kind: 'visit_prep',
    to: client.email,
    subject,
    bodyPreview: plainBody,
    smsBody: client.phone ? sms : null,
    html: emailHtml,
    channels: [
      ...(client.email ? (['email'] as const) : []),
      ...(client.phone ? (['sms'] as const) : []),
      'portal',
    ],
  };

  return {
    ok: true as const,
    client,
    offerId,
    whenLabel,
    address,
    mapUrl,
    subject,
    sms,
    intro,
    emailHtml,
    identity,
    portalUrl,
    preview,
  };
}

export async function previewVisitPrepPacket(params: {
  agencyUserId: number;
  clientId: number;
  parkingNote?: string | null;
}) {
  const built = await buildVisitPrepPacket(params);
  if (!built.ok) return built;
  return { ok: true as const, preview: built.preview };
}

export async function sendVisitPrepPacket(params: {
  agencyUserId: number;
  clientId: number;
  parkingNote?: string | null;
  /** Agent zobaczył podgląd pakietu. */
  approved?: boolean;
}) {
  const built = await buildVisitPrepPacket(params);
  if (!built.ok) return built;

  const delivery = await deliverToClient({
    agencyUserId: params.agencyUserId,
    clientId: built.client.id,
    category: 'visit',
    source: 'visit_prep_packet',
    approved: params.approved,
    steps: [
      ...(built.client.email
        ? [emailStep({ to: built.client.email, subject: built.subject, html: built.emailHtml })]
        : []),
      ...(built.client.phone ? [{ kind: 'sms' as const, to: built.client.phone, message: built.sms }] : []),
    ],
  });
  const emailSent = delivery.emailSent;
  const smsSent = delivery.smsSent;

  await prisma.agencyClientActivity.create({
    data: {
      clientId: built.client.id,
      agencyUserId: params.agencyUserId,
      offerId: built.offerId || undefined,
      kind: 'VISIT_PREP_PACKET',
      title: delivery.queued ? 'Pakiet przed wizytą czeka na akceptację' : 'Wysłano pakiet przed wizytą',
      body: built.whenLabel,
      metadata: {
        emailSent,
        smsSent,
        address: built.address,
        mapUrl: built.mapUrl,
        subject: built.subject,
        bodyPreview: built.preview.bodyPreview,
        smsBody: built.sms,
        to: built.client.email,
      },
    },
  });

  return {
    ok: true as const,
    queued: delivery.queued,
    outboxId: delivery.outboxId,
    emailSent,
    smsSent,
    smsBody: built.sms,
    preview: built.preview,
    mailto: built.client.email
      ? {
          to: built.client.email,
          subject: built.subject,
          body: built.preview.bodyPreview,
        }
      : null,
  };
}
