import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { sendSMS } from '@/lib/sms';
import {
  buildAppleClientEmailHtml,
  escapeEmailHtml,
  loadAppleClientEmailIdentity,
} from '@/lib/email/appleClientEmail';

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

export async function sendVisitPrepPacket(params: {
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

  const when = new Date(slot.startsAt);
  const whenLabel = when.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const whenShort = when.toLocaleString('pl-PL', {
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
  const intro =
    'Przypominamy o umówionym oglądaniu. Termin, adres i mapa są poniżej — prosimy o punktualność.';

  const sms = `Oglądanie: ${whenShort}, ${address}. Szczegóły: ${portalUrl} — ${identity.agentName}`;

  const subject = `Oglądanie · ${whenShort} · ${address}`;

  const emailHtml = buildAppleClientEmailHtml({
    eyebrow: identity.agencyName,
    title: 'Pakiet przed wizytą',
    greetingName: client.firstName,
    bodyHtml: `
      <p style="margin:0 0 12px;">${escapeEmailHtml(intro)}</p>
      <p style="margin:0 0 12px;">Na miejscu spotkacie się z agentem. W razie potrzeby napisz w panelu — odpowiemy od razu.</p>
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
    ctas: [{ label: 'Otwórz panel klienta', href: portalUrl, variant: 'primary' }],
    footerNote: 'EstateOS™ · pakiet przed wizytą',
  });

  let emailSent = false;
  if (client.email) {
    emailSent = await sendTransactionalEmail({
      to: client.email,
      subject,
      html: emailHtml,
    });
  }

  let smsSent = false;
  if (client.phone) {
    try {
      await sendSMS(client.phone, sms);
      smsSent = true;
    } catch {
      smsSent = false;
    }
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      offerId: offerId || undefined,
      kind: 'VISIT_PREP_PACKET',
      title: 'Wysłano pakiet przed wizytą',
      body: whenLabel,
      metadata: { emailSent, smsSent, address, mapUrl },
    },
  });

  return {
    ok: true as const,
    emailSent,
    smsSent,
    smsBody: sms,
    mailto: client.email
      ? {
          to: client.email,
          subject,
          body: `Dzień dobry ${client.firstName},\n\n${intro}\n\n${whenLabel}\n${address}\nMapa: ${mapUrl}\nPanel: ${portalUrl}\n\n${identity.agentName}`,
        }
      : null,
  };
}
