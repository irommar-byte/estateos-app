import { prisma } from '@/lib/prisma';
import { generatePortalToken, buildPortalUrl } from '@/lib/agencyClientNotify';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';
import { findDuplicateAgencyClients } from '@/lib/crm/clientDuplicate';
import { serializeClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import { parseOtodomLeadEmail } from '@/lib/crm/parseOtodomLeadEmail';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';

function normalizePhone(raw: unknown): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;
  const normalized = input.replace(/[^\d+]/g, '');
  if (normalized.startsWith('+') && normalized.length >= 10) return normalized;
  const digits = normalized.replace(/\D/g, '');
  if (digits.length === 9) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith('48')) return `+${digits}`;
  return null;
}

export type CapturePortalLeadInput = {
  agencyUserId: number;
  paste?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  offerId?: number | null;
  source?: string;
  contactConsent?: boolean;
  forceUseClientId?: number | null;
};

export async function capturePortalLead(input: CapturePortalLeadInput) {
  const parsed = input.paste ? parseOtodomLeadEmail(input.paste) : null;
  const firstName = String(input.firstName || parsed?.firstName || '').trim();
  const lastName = String(input.lastName || parsed?.lastName || '').trim();
  if (!firstName || !lastName || lastName === '—') {
    if (!firstName) {
      return { ok: false as const, status: 400, error: 'Podaj imię klienta.' };
    }
  }
  const resolvedLast = lastName && lastName !== '—' ? lastName : 'Portal';

  const email = (input.email ?? parsed?.email)?.trim().toLowerCase() || null;
  const phone = normalizePhone(input.phone ?? parsed?.phone);
  const offerIdRaw = Number(input.offerId || parsed?.officeOfferId || 0);
  const offerId = Number.isFinite(offerIdRaw) && offerIdRaw > 0 ? offerIdRaw : null;
  if (!offerId) {
    return {
      ok: false as const,
      status: 400,
      error: 'Podaj Numer w biurze (= ID oferty EstateOS). Nie używamy ID z Otodom.',
    };
  }
  if (!email && !phone) {
    return { ok: false as const, status: 400, error: 'Potrzebny e-mail albo telefon klienta.' };
  }
  if (input.contactConsent !== true) {
    return { ok: false as const, status: 400, error: 'Zaznacz zgodę na kontakt z klientem.' };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: offerId },
    select: {
      id: true,
      title: true,
      city: true,
      district: true,
      street: true,
      price: true,
      userId: true,
      status: true,
    },
  });
  if (!offer) {
    return {
      ok: false as const,
      status: 404,
      error: `Oferta #${offerId} nieznaleziona w EstateOS. Sprawdź Numer w biurze.`,
    };
  }

  const source = String(input.source || parsed?.source || 'otodom').toLowerCase();
  const message =
    String(input.message || parsed?.message || '').trim() ||
    'Klient chce umówić wizytę (lead z portalu).';

  let clientId = Number(input.forceUseClientId || 0) || null;
  let created = false;

  if (!clientId) {
    const duplicates = await findDuplicateAgencyClients({
      agencyUserId: input.agencyUserId,
      email,
      phone,
    });
    if (duplicates.length) {
      return {
        ok: false as const,
        status: 409,
        error: 'Klient o tym e-mailu lub telefonie już jest w CRM.',
        code: 'DUPLICATE_CLIENT' as const,
        matches: duplicates,
        offerId,
        parsed,
      };
    }

    const linkedUserId = await ensureAgencyClientLinkedUser({
      email,
      phone,
      name: `${firstName} ${resolvedLast}`.trim(),
    });

    const client = await prisma.agencyClient.create({
      data: {
        agencyUserId: input.agencyUserId,
        type: 'BUYER',
        firstName,
        lastName: resolvedLast,
        email,
        phone,
        notes: `Lead ${source}. ${message}`.slice(0, 2000),
        portalToken: generatePortalToken(),
        linkedUserId,
      },
      select: { id: true, portalToken: true, firstName: true, lastName: true, email: true, phone: true },
    });
    clientId = client.id;
    created = true;

    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: input.agencyUserId,
        offerId,
        kind: 'CLIENT_CREATED',
        title: 'Dodano klienta (lead portalowy)',
        body: `${firstName} ${resolvedLast} · ${source} · oferta #${offerId}`,
        metadata: {
          leadSource: source,
          portalListingId: parsed?.portalListingId || null,
          officeOfferId: offerId,
        },
      },
    });
  } else {
    const existing = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId: input.agencyUserId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!existing) {
      return { ok: false as const, status: 404, error: 'Nie znaleziono klienta do dopięcia.' };
    }
  }

  const feedback = serializeClientOfferFeedback({
    sentiment: 'like',
    liked: '',
    disliked: '',
    phrases: [],
    note: message,
  });

  const match = await prisma.agencyClientMatch.upsert({
    where: { clientId_offerId: { clientId: clientId!, offerId } },
    create: {
      clientId: clientId!,
      offerId,
      score: 95,
      clientFeedback: feedback,
      clientFeedbackAt: new Date(),
      sharedAt: new Date(),
      notifiedAt: new Date(),
    },
    update: {
      clientFeedback: feedback,
      clientFeedbackAt: new Date(),
      sharedAt: new Date(),
      notifiedAt: new Date(),
    },
    select: { id: true },
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: clientId!,
      agencyUserId: input.agencyUserId,
      offerId,
      kind: 'EXTERNAL_PORTAL_LEAD',
      title: `Lead portalowy · #${offerId}`,
      body: message,
      metadata: {
        matchId: match.id,
        leadSource: source,
        portalListingId: parsed?.portalListingId || null,
        officeOfferId: offerId,
        contactConsent: true,
      },
    },
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: clientId!,
      agencyUserId: input.agencyUserId,
      offerId,
      kind: 'CLIENT_FEEDBACK',
      title: `Klient chce obejrzeć: ${offer.title}`,
      body: message,
      metadata: {
        matchId: match.id,
        offerTitle: offer.title,
        offerCity: offer.city,
        offerDistrict: offer.district,
        sentiment: 'like',
      },
    },
  });

  const client = await prisma.agencyClient.findUniqueOrThrow({
    where: { id: clientId! },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      portalToken: true,
    },
  });

  const agency = await prisma.user.findUnique({
    where: { id: input.agencyUserId },
    select: { name: true, companyName: true, phone: true },
  });

  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : 'https://estateos.pl';
  const agentName = agency?.name || 'Agent';
  const agencyName = agency?.companyName || 'EstateOS';
  const welcomeSms = `Dzień dobry ${client.firstName}, tu ${agentName} (${agencyName}). Dziękuję za zainteresowanie: ${offer.title}. Zaraz prześlę propozycje terminów oglądania.${agency?.phone ? ` Tel. ${agency.phone}` : ''}`;
  const welcomeEmailSubject = `Oglądanie: ${offer.title}`;
  const welcomeEmailBody = `Dzień dobry ${client.firstName},

dziękuję za wiadomość w sprawie oferty:
${offer.title}${offer.city ? ` · ${offer.city}` : ''}${offer.price != null ? ` · ${Math.round(Number(offer.price)).toLocaleString('pl-PL')} zł` : ''}

Jestem ${agentName} z ${agencyName}. Chętnie pokażę nieruchomość i odpowiem na pytania na miejscu.

W kolejnej wiadomości prześlę 2–3 propozycje terminów.
Prywatny panel (terminy, ofertówka, kolejne propozycje):
${portalUrl}

Pozdrawiam serdecznie,
${agentName}
${agencyName}${agency?.phone ? `\n${agency.phone}` : ''}`;

  await sendNotification({
    userId: input.agencyUserId,
    type: 'CRM_EVENT',
    title: 'Nowy lead portalowy',
    body: `${client.firstName} ${client.lastName} · chce oglądać #${offerId}`,
    data: crmAgentPushData(client.id, { notificationType: 'crm_portal_lead', offerId }),
  }).catch(() => {});

  return {
    ok: true as const,
    created,
    clientId: client.id,
    offerId,
    offer: {
      id: offer.id,
      title: offer.title,
      city: offer.city,
      street: offer.street,
      price: offer.price,
    },
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      portalUrl,
    },
    welcome: {
      sms: welcomeSms,
      emailSubject: welcomeEmailSubject,
      emailBody: welcomeEmailBody,
      otodomReminder: 'Odpowiedz też na Otodom (przycisk w mailu), żeby wątek na portalu nie wisiał.',
    },
    parsed,
  };
}
