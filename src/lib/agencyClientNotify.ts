import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { appendPresentationQuery } from '@/lib/offerPresentingAgent';

function buildTransporter() {
  const smtpPort = Number(process.env.EMAIL_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: false },
  });
}

export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildPortalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl';
  return `${base.replace(/\/$/, '')}/klient/${token}`;
}

type OfferBrief = {
  id: number;
  title: string;
  city: string;
  district: string | null;
  price: number;
  priceCurrency: string | null;
  imageUrl?: string;
};

function formatOfferLine(offer: OfferBrief): string {
  const location = [offer.city, offer.district].filter(Boolean).join(', ');
  const priceLabel = `${Math.round(offer.price).toLocaleString('pl-PL')} ${offer.priceCurrency || 'PLN'}`;
  return `${offer.title} (${location}, ${priceLabel})`;
}

function offerUrlForClient(offerId: number, portalToken: string | null | undefined): string {
  const base = `https://estateos.pl/oferta/${offerId}`;
  if (!portalToken) return base;
  return `https://estateos.pl${appendPresentationQuery(`/oferta/${offerId}`, { portalToken })}`;
}

function buildEmailHtml(params: {
  agencyName: string;
  agentName: string;
  clientName: string;
  intro: string;
  offers: OfferBrief[];
  portalUrl?: string | null;
  portalToken?: string | null;
}) {
  const { agencyName, agentName, clientName, intro, offers, portalUrl, portalToken } = params;
  const offerBlocks = offers
    .map((offer) => {
      const offerUrl = offerUrlForClient(offer.id, portalToken);
      const location = [offer.city, offer.district].filter(Boolean).join(', ');
      const priceLabel = `${Math.round(offer.price).toLocaleString('pl-PL')} ${offer.priceCurrency || 'PLN'}`;
      return `
        <div style="background:#f9fafb;border-radius:16px;padding:20px;margin-bottom:16px;">
          <p style="margin:0 0 6px;font-weight:600;color:#111;">${offer.title}</p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">${location} · ${priceLabel}</p>
          <a href="${offerUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-weight:700;font-size:12px;">Zobacz ofertę</a>
        </div>`;
    })
    .join('');

  const portalBlock = portalUrl
    ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;">Możesz też zalogować się do swojego panelu klienta i zostawić uwagi do każdej propozycji: <a href="${portalUrl}" style="color:#059669;">${portalUrl}</a></p>`
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;border:1px solid #e5e7eb;">
        <p style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#059669;margin:0 0 12px;">${agencyName}</p>
        <h1 style="font-size:22px;margin:0 0 8px;color:#111;">Witaj ${clientName},</h1>
        <p style="color:#374151;line-height:1.6;margin:0 0 20px;">${intro}</p>
        ${offerBlocks}
        ${portalBlock}
        <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Pozdrawiam serdecznie,<br><strong>${agentName}</strong><br>${agencyName}</p>
      </div>
    </div>`;
}

export async function buildAgencyClientEmailPreview(params: {
  clientId: number;
  offerIds: number[];
  agencyUserId: number;
  customMessage?: string;
}) {
  const offerIds = [...new Set(params.offerIds.filter((id) => Number.isFinite(id)))];
  if (!offerIds.length) throw new Error('Wybierz co najmniej jedną ofertę.');

  const [client, offers, agent] = await Promise.all([
    prisma.agencyClient.findFirst({
      where: { id: params.clientId, agencyUserId: params.agencyUserId },
    }),
    prisma.offer.findMany({
      where: { id: { in: offerIds } },
      select: { id: true, title: true, city: true, district: true, price: true, priceCurrency: true },
    }),
    prisma.user.findUnique({
      where: { id: params.agencyUserId },
      select: { name: true, companyName: true, email: true, phone: true },
    }),
  ]);

  if (!client || !agent) throw new Error('Nie znaleziono klienta lub agenta.');
  if (!offers.length) throw new Error('Nie znaleziono ofert.');

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Twój agent';
  const agencyName = agent.companyName?.trim() || 'EstateOS';
  const clientName = `${client.firstName}`.trim() || 'Kliencie';
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;

  const offerBriefs: OfferBrief[] = offers.map((o) => ({ ...o, district: o.district }));
  const defaultIntro =
    offerBriefs.length === 1
      ? `Przygotowałem dla Ciebie propozycję, która może Cię zainteresować — ${formatOfferLine(offerBriefs[0])}.`
      : `Przygotowałem dla Ciebie ${offerBriefs.length} propozycje dopasowane do Twoich kryteriów. Poniżej znajdziesz szczegóły każdej z nich.`;

  const intro = params.customMessage?.trim() || defaultIntro;
  const subject =
    offerBriefs.length === 1
      ? `${agentName}: nowa propozycja — ${offerBriefs[0].title}`
      : `${agentName}: ${offerBriefs.length} nowych propozycji dla Ciebie`;

  const html = buildEmailHtml({
    agencyName,
    agentName,
    clientName,
    intro,
    offers: offerBriefs,
    portalUrl,
    portalToken: client.portalToken,
  });

  return {
    subject,
    html,
    intro,
    agentName,
    agencyName,
    clientName,
    clientEmail: client.email,
    offers: offerBriefs,
    portalUrl,
  };
}

export async function notifyAgencyClientAboutOffer(params: {
  clientId: number;
  offerId: number;
  agencyUserId: number;
  channel: 'email' | 'manual';
  customMessage?: string;
  skipIfNotified?: boolean;
}) {
  if (params.skipIfNotified !== false) {
    const existing = await prisma.agencyClientMatch.findUnique({
      where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
      select: { notifiedAt: true },
    });
    if (existing?.notifiedAt && params.channel === 'email') {
      return { emailSent: false, offerUrl: `https://estateos.pl/oferta/${params.offerId}`, alreadyNotified: true };
    }
  }

  const preview = await buildAgencyClientEmailPreview({
    clientId: params.clientId,
    offerIds: [params.offerId],
    agencyUserId: params.agencyUserId,
    customMessage: params.customMessage,
  });

  let emailSent = false;
  if (params.channel === 'email' && preview.clientEmail) {
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: `"${preview.agencyName}" <powiadomienia@estateos.pl>`,
      to: preview.clientEmail,
      replyTo: (await prisma.user.findUnique({ where: { id: params.agencyUserId }, select: { email: true } }))?.email || undefined,
      subject: preview.subject,
      html: preview.html,
    });
    emailSent = true;
  }

  await prisma.agencyClientMatch.upsert({
    where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
    create: { clientId: params.clientId, offerId: params.offerId, score: 0, notifiedAt: emailSent ? new Date() : undefined },
    update: emailSent ? { notifiedAt: new Date() } : {},
  });

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId: params.offerId,
      kind: emailSent ? 'CLIENT_NOTIFIED' : 'OFFER_SHARED',
      title: emailSent ? 'Wysłano ofertę e-mailem' : 'Zapisano udostępnienie oferty',
      body: preview.intro,
      metadata: { channel: params.channel, emailSent },
    },
  });

  return { emailSent, offerUrl: `https://estateos.pl/oferta/${params.offerId}`, preview };
}

export async function notifyAgencyClientAboutOffers(params: {
  clientId: number;
  offerIds: number[];
  agencyUserId: number;
  channel: 'email' | 'manual';
  customMessage?: string;
}) {
  const offerIds = [...new Set(params.offerIds.filter((id) => Number.isFinite(id)))];
  if (!offerIds.length) throw new Error('Wybierz co najmniej jedną ofertę.');

  const preview = await buildAgencyClientEmailPreview({
    clientId: params.clientId,
    offerIds,
    agencyUserId: params.agencyUserId,
    customMessage: params.customMessage,
  });

  const alreadyNotified = await prisma.agencyClientMatch.findMany({
    where: { clientId: params.clientId, offerId: { in: offerIds }, notifiedAt: { not: null } },
    select: { offerId: true },
  });
  const blockedIds = new Set(alreadyNotified.map((m) => m.offerId));
  const toSend = offerIds.filter((id) => !blockedIds.has(id));

  if (!toSend.length && params.channel === 'email') {
    throw new Error('Wszystkie zaznaczone oferty zostały już wysłane tym klientowi.');
  }

  let emailSent = false;
  if (params.channel === 'email' && preview.clientEmail && toSend.length) {
    const sendOffers = preview.offers.filter((o) => toSend.includes(o.id));
    const sendPreview = buildEmailHtml({
      agencyName: preview.agencyName,
      agentName: preview.agentName,
      clientName: preview.clientName,
      intro: preview.intro,
      offers: sendOffers,
      portalUrl: preview.portalUrl,
      portalToken: (await prisma.agencyClient.findFirst({
        where: { id: params.clientId },
        select: { portalToken: true },
      }))?.portalToken,
    });
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: `"${preview.agencyName}" <powiadomienia@estateos.pl>`,
      to: preview.clientEmail,
      replyTo: (await prisma.user.findUnique({ where: { id: params.agencyUserId }, select: { email: true } }))?.email || undefined,
      subject: preview.subject,
      html: sendPreview,
    });
    emailSent = true;
  }

  const now = emailSent ? new Date() : undefined;
  for (const offerId of toSend) {
    await prisma.agencyClientMatch.upsert({
      where: { clientId_offerId: { clientId: params.clientId, offerId } },
      create: { clientId: params.clientId, offerId, score: 0, notifiedAt: now },
      update: now ? { notifiedAt: now } : {},
    });
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      kind: emailSent ? 'CLIENT_NOTIFIED' : 'OFFER_SHARED',
      title: emailSent ? `Wysłano ${toSend.length} ofert e-mailem` : `Udostępniono ${toSend.length} ofert`,
      body: preview.intro,
      metadata: { channel: params.channel, emailSent, offerIds: toSend },
    },
  });

  return { emailSent, sentCount: toSend.length, skippedCount: blockedIds.size, preview };
}
