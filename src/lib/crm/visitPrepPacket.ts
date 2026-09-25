import { prisma } from '@/lib/prisma';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { sendSMS } from '@/lib/sms';

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

  const agency = await prisma.user.findUnique({
    where: { id: params.agencyUserId },
    select: { name: true, companyName: true, phone: true },
  });

  const when = new Date(slot.startsAt);
  const whenLabel = when.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const address =
    slot.location ||
    [offer?.street, offer?.district, offer?.city].filter(Boolean).join(', ') ||
    offer?.title ||
    'adres u agenta';
  const mapUrl =
    offer?.lat != null && offer?.lng != null
      ? `https://maps.apple.com/?ll=${offer.lat},${offer.lng}&q=${encodeURIComponent(address)}`
      : `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';
  const agentName = agency?.name || 'Agent';
  const agencyName = agency?.companyName || 'EstateOS';
  const parking = String(params.parkingNote || '').trim() || 'Szczegóły parkingu ustalisz z agentem na miejscu.';

  const sms = `Przypomnienie: ${whenLabel}, ${address}. Odbiorę Państwa na miejscu. Szczegóły: ${portalUrl} — ${agentName}`;
  const emailHtml = `<div style="font-family:-apple-system,sans-serif;padding:24px;max-width:560px">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#059669;font-weight:800">${agencyName}</p>
    <h2>Pakiet przed wizytą</h2>
    <p>Dzień dobry ${client.firstName},</p>
    <p>spotykamy się na oglądaniu:</p>
    <p>📅 <strong>${whenLabel}</strong><br/>📍 ${address}<br/>🗺️ <a href="${mapUrl}">Mapa</a><br/>🅿️ ${parking}<br/>👤 ${agentName}${agency?.phone ? `, tel. ${agency.phone}` : ''}</p>
    <p>Na miejscu dostaną Państwo ofertówkę do ręki.</p>
    <p><a href="${portalUrl}" style="display:inline-block;background:#10b981;color:#07130e;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Otwórz panel</a></p>
  </div>`;

  let emailSent = false;
  if (client.email) {
    emailSent = await sendTransactionalEmail({
      to: client.email,
      subject: `Jutro oglądamy — ${address}`,
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
          subject: `Jutro oglądamy — ${address}`,
          body: `Dzień dobry ${client.firstName},\n\nspotykamy się:\n${whenLabel}\n${address}\nMapa: ${mapUrl}\nPanel: ${portalUrl}\n\n${agentName}`,
        }
      : null,
  };
}
