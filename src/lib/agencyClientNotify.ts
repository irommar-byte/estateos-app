import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type OfferBrief = {
  id: number;
  title: string;
  city: string;
  district: string | null;
  price: number;
  priceCurrency: string | null;
  imageUrl?: string;
  area?: number | null;
  rooms?: number | null;
};

function formatPriceLabel(offer: OfferBrief): string {
  return `${Math.round(offer.price).toLocaleString('pl-PL')} ${offer.priceCurrency || 'PLN'}`;
}

function formatLocation(offer: OfferBrief): string {
  return [offer.city, offer.district].filter(Boolean).join(', ');
}

function offerUrlForClient(offerId: number, portalToken: string | null | undefined): string {
  const base = `https://estateos.pl/oferta/${offerId}`;
  if (!portalToken) return base;
  return `https://estateos.pl${appendPresentationQuery(`/oferta/${offerId}`, { portalToken })}`;
}

function formatMetaLine(offer: OfferBrief): string {
  const bits: string[] = [];
  if (offer.rooms != null && Number(offer.rooms) > 0) {
    bits.push(`${offer.rooms} pok.`);
  }
  if (offer.area != null && Number(offer.area) > 0) {
    bits.push(`${Math.round(Number(offer.area))} m²`);
  }
  return bits.join(' · ');
}

function buildOfferCardHtml(offer: OfferBrief, portalToken?: string | null): string {
  const offerUrl = offerUrlForClient(offer.id, portalToken);
  const location = formatLocation(offer);
  const priceLabel = formatPriceLabel(offer);
  const meta = formatMetaLine(offer);
  const imageUrl = offer.imageUrl ? absolutizeMediaUrl(offer.imageUrl) : '';

  const imageBlock = imageUrl
    ? `<tr>
        <td style="padding:0;line-height:0;font-size:0;">
          <a href="${escapeHtml(offerUrl)}" style="display:block;text-decoration:none;">
            <img src="${escapeHtml(imageUrl)}" width="504" alt="${escapeHtml(offer.title)}" style="display:block;width:100%;max-width:504px;height:auto;border:0;object-fit:cover;" />
          </a>
        </td>
      </tr>`
    : '';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 18px;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
      ${imageBlock}
      <tr>
        <td style="padding:20px 22px 22px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#059669;">${escapeHtml(location || 'Nieruchomość')}</p>
          <p style="margin:0 0 8px;font-size:18px;line-height:1.3;font-weight:800;color:#111827;letter-spacing:-0.02em;">${escapeHtml(offer.title)}</p>
          <p style="margin:0 0 4px;font-size:20px;font-weight:900;color:#111827;letter-spacing:-0.03em;">${escapeHtml(priceLabel)}</p>
          ${meta ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">${escapeHtml(meta)}</p>` : `<div style="height:12px;line-height:12px;font-size:12px;">&nbsp;</div>`}
          <a href="${escapeHtml(offerUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Zobacz ofertę</a>
        </td>
      </tr>
    </table>`;
}

function buildEmailHtml(params: {
  agencyName: string;
  agentName: string;
  clientName: string;
  intro: string;
  offers: OfferBrief[];
  portalUrl?: string | null;
  portalToken?: string | null;
  agentPhone?: string | null;
  agentEmail?: string | null;
}) {
  const {
    agencyName,
    agentName,
    clientName,
    intro,
    offers,
    portalUrl,
    portalToken,
    agentPhone,
    agentEmail,
  } = params;

  const eyebrow =
    offers.length === 1 ? 'Propozycja specjalnie dla Ciebie' : 'Propozycje specjalnie dla Ciebie';
  const count = offers.length;
  const countLabel =
    count === 1 ? '1 ofertę' : count < 5 ? `${count} oferty` : `${count} ofert`;
  const headline =
    count === 1 ? `Witaj ${clientName}` : `Witaj ${clientName} — wybrałem ${countLabel}`;

  const offerBlocks = offers.map((offer) => buildOfferCardHtml(offer, portalToken)).join('');

  const portalBlock = portalUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 0;background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111827;">Twój prywatny panel klienta</p>
            <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#6b7280;">W panelu zobaczysz wszystkie propozycje w jednym miejscu i możesz zostawić uwagi do każdej z nich.</p>
            <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#10b981;color:#052e1c;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Otwórz panel klienta</a>
          </td>
        </tr>
      </table>`
    : '';

  const contactBits = [
    agentPhone
      ? `<a href="tel:${escapeHtml(agentPhone)}" style="color:#111827;font-weight:700;text-decoration:none;">${escapeHtml(agentPhone)}</a>`
      : '',
    agentEmail
      ? `<a href="mailto:${escapeHtml(agentEmail)}" style="color:#111827;font-weight:700;text-decoration:none;">${escapeHtml(agentEmail)}</a>`
      : '',
  ].filter(Boolean);

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#0b1220 0%,#102a23 55%,#0f766e 100%);padding:28px 28px 34px;">
        <p style="margin:0 0 14px;font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#6ee7b7;">${escapeHtml(agencyName)}</p>
        <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.55);">${escapeHtml(eyebrow)}</p>
        <h1 style="margin:8px 0 0;font-size:26px;line-height:1.15;color:#ffffff;letter-spacing:-0.03em;">${escapeHtml(headline)}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 22px;color:#374151;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
        ${offerBlocks}
        ${portalBlock}
        <div style="margin-top:26px;padding-top:20px;border-top:1px solid #f3f4f6;">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Pozdrawiam serdecznie,</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:#111827;">${escapeHtml(agentName)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(agencyName)}</p>
          ${
            contactBits.length
              ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">${contactBits.join(' · ')}</p>`
              : ''
          }
        </div>
        <p style="margin:22px 0 0;text-align:center;font-size:11px;color:#9ca3af;">EstateOS™ · oferta przygotowana indywidualnie dla Ciebie</p>
      </div>
    </div>
  </div>`;
}

function toOfferBrief(row: {
  id: number;
  title: string;
  city: string;
  district: string | null;
  price: number;
  priceCurrency: string | null;
  area?: number | null;
  rooms?: number | null;
  images?: unknown;
}): OfferBrief {
  const raw = resolveOfferPrimaryImage({ images: row.images });
  const imageUrl = raw ? absolutizeMediaUrl(raw) : undefined;
  return {
    id: row.id,
    title: row.title,
    city: row.city,
    district: row.district,
    price: row.price,
    priceCurrency: row.priceCurrency,
    area: row.area ?? null,
    rooms: row.rooms ?? null,
    imageUrl,
  };
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
      select: {
        id: true,
        title: true,
        city: true,
        district: true,
        price: true,
        priceCurrency: true,
        area: true,
        rooms: true,
        images: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: params.agencyUserId },
      select: { name: true, companyName: true, email: true, phone: true },
    }),
  ]);

  if (!client || !agent) throw new Error('Nie znaleziono klienta lub agenta.');
  if (!offers.length) throw new Error('Nie znaleziono ofert.');

  const byId = new Map(offers.map((o) => [o.id, o]));
  const ordered = offerIds.map((id) => byId.get(id)).filter(Boolean) as typeof offers;

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Twój agent';
  const agencyName = agent.companyName?.trim() || 'EstateOS';
  const clientName = `${client.firstName}`.trim() || 'Kliencie';
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;

  const offerBriefs: OfferBrief[] = ordered.map(toOfferBrief);
  const defaultIntro =
    offerBriefs.length === 1
      ? `Wybrałem dla Ciebie jedną nieruchomość, która — moim zdaniem — szczególnie pasuje do Twoich oczekiwań. Zerknij proszę na zdjęcia i szczegóły poniżej.`
      : `Przygotowałem dla Ciebie ${offerBriefs.length} starannie dobrane propozycje. Każda z nich może być kolejnym krokiem w poszukiwaniach — poniżej znajdziesz zdjęcia i kluczowe informacje.`;

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
    agentPhone: agent.phone,
    agentEmail: agent.email,
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
    agentPhone: agent.phone,
    agentEmail: agent.email,
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
      replyTo: preview.agentEmail || undefined,
      subject: preview.subject,
      html: preview.html,
    });
    emailSent = true;
  }

  const now = new Date();
  await prisma.agencyClientMatch.upsert({
    where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
    create: {
      clientId: params.clientId,
      offerId: params.offerId,
      score: 0,
      notifiedAt: now,
      sharedAt: now,
    },
    update: { notifiedAt: now, sharedAt: now },
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
    const client = await prisma.agencyClient.findFirst({
      where: { id: params.clientId },
      select: { portalToken: true },
    });
    const sendPreview = buildEmailHtml({
      agencyName: preview.agencyName,
      agentName: preview.agentName,
      clientName: preview.clientName,
      intro: preview.intro,
      offers: sendOffers,
      portalUrl: preview.portalUrl,
      portalToken: client?.portalToken,
      agentPhone: preview.agentPhone,
      agentEmail: preview.agentEmail,
    });
    const transporter = buildTransporter();
    await transporter.sendMail({
      from: `"${preview.agencyName}" <powiadomienia@estateos.pl>`,
      to: preview.clientEmail,
      replyTo: preview.agentEmail || undefined,
      subject: preview.subject,
      html: sendPreview,
    });
    emailSent = true;
  }

  const now = new Date();
  for (const offerId of toSend) {
    await prisma.agencyClientMatch.upsert({
      where: { clientId_offerId: { clientId: params.clientId, offerId } },
      create: { clientId: params.clientId, offerId, score: 0, notifiedAt: now, sharedAt: now },
      update: { notifiedAt: now, sharedAt: now },
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
