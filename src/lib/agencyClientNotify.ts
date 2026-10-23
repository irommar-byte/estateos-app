import crypto from 'crypto';
import { deliverToClient, emailStep, isClientAutoSendAllowed, type OutboxStep } from '@/lib/crm/clientOutbox';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { absolutizeMediaUrl } from '@/lib/offerShareLanding';
import { appendPresentationQuery } from '@/lib/offerPresentingAgent';
import { DISLIKE_PHRASES, LIKE_PHRASES } from '@/lib/crm/clientPortalFeedback';
import { buildClientVoice, type ClientVoice } from '@/lib/crm/clientVoice';
import {
  EMAIL_REACTION_COPY,
  emailSignoff,
  ensureGreeting,
  offerEmailCopy,
  offerPushCopy,
  portalBlockCopy,
  reminderCopy,
} from '@/lib/crm/clientCopy';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';

async function resolveClientMatchScore(params: {
  clientId: number;
  offerId: number;
  matchScore?: number;
}): Promise<number> {
  if (Number.isFinite(params.matchScore) && Number(params.matchScore) > 0) {
    return Math.round(Number(params.matchScore));
  }

  const existing = await prisma.agencyClientMatch.findUnique({
    where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
    select: { score: true },
  });
  if (existing && existing.score > 0) return existing.score;

  await refreshAgencyClientMatches(params.clientId);
  const refreshed = await prisma.agencyClientMatch.findUnique({
    where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
    select: { score: true },
  });
  return refreshed?.score && refreshed.score > 0 ? refreshed.score : 0;
}

export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildPortalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://estateos.pl';
  return `${base.replace(/\/$/, '')}/klient/${token}`;
}

export function buildPortalDocumentUrl(token: string): string {
  return `${buildPortalUrl(token)}/dokument`;
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

function portalReactUrl(
  token: string,
  offerId: number,
  sentiment: 'like' | 'maybe' | 'dislike',
  phrase?: string,
): string {
  const url = new URL(buildPortalUrl(token));
  url.searchParams.set('offer', String(offerId));
  url.searchParams.set('react', sentiment);
  if (phrase) url.searchParams.set('phrase', phrase);
  return url.toString();
}

function emailChip(href: string, label: string, bg: string, color: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 6px 8px 0;background:${bg};color:${color};text-decoration:none;padding:9px 14px;border-radius:999px;font-weight:800;font-size:11px;letter-spacing:0.04em;">${escapeHtml(label)}</a>`;
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
          ${
            portalToken
              ? `<div style="margin-top:18px;padding-top:16px;border-top:1px solid #f3f4f6;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#059669;">${EMAIL_REACTION_COPY.likeHeader}</p>
                  ${emailChip(portalReactUrl(portalToken, offer.id, 'like'), EMAIL_REACTION_COPY.likeMain, '#10b981', '#052e1c')}
                  ${LIKE_PHRASES.slice(0, 3)
                    .map((phrase) => emailChip(portalReactUrl(portalToken, offer.id, 'like', phrase), phrase, '#ecfdf5', '#065f46'))
                    .join('')}
                  <p style="margin:10px 0 8px;font-size:11px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#be123c;">${EMAIL_REACTION_COPY.dislikeHeader}</p>
                  ${emailChip(portalReactUrl(portalToken, offer.id, 'dislike'), EMAIL_REACTION_COPY.dislikeMain, '#e11d48', '#ffffff')}
                  ${DISLIKE_PHRASES.slice(0, 3)
                    .map((phrase) => emailChip(portalReactUrl(portalToken, offer.id, 'dislike', phrase), phrase, '#fff1f2', '#9f1239'))
                    .join('')}
                  <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">${EMAIL_REACTION_COPY.note}</p>
                </div>`
              : ''
          }
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
  voice?: ClientVoice;
  eyebrow?: string;
  headline?: string;
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

  const voice = params.voice || buildClientVoice({ firstName: clientName, agentName });
  const defaults = offerEmailCopy(voice, { count: offers.length, firstTitle: offers[0]?.title });
  const eyebrow = params.eyebrow || defaults.eyebrow;
  const headline = params.headline || defaults.headline;
  const portalCopy = portalBlockCopy(voice);
  const introHtml = ensureGreeting(intro, voice)
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map(
      (para) =>
        `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.65;">${escapeHtml(para).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  const offerBlocks = offers.map((offer) => buildOfferCardHtml(offer, portalToken)).join('');

  const portalBlock = portalUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 0;background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;">
        <tr>
          <td style="padding:18px 20px;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111827;">${escapeHtml(portalCopy.title)}</p>
            <p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#6b7280;">${escapeHtml(portalCopy.body)}</p>
            <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#10b981;color:#052e1c;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:800;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(portalCopy.cta)}</a>
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
        <div style="margin:0 0 10px;">${introHtml}</div>
        ${offerBlocks}
        ${portalBlock}
        <div style="margin-top:26px;padding-top:20px;border-top:1px solid #f3f4f6;">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${escapeHtml(emailSignoff(voice))}</p>
          <p style="margin:0;font-size:16px;font-weight:800;color:#111827;">${escapeHtml(agentName)}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(agencyName)}</p>
          ${
            contactBits.length
              ? `<p style="margin:10px 0 0;font-size:13px;color:#6b7280;">${contactBits.join(' · ')}</p>`
              : ''
          }
        </div>
        <p style="margin:22px 0 0;text-align:center;font-size:11px;color:#9ca3af;">${escapeHtml(agencyName)} · EstateOS™</p>
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
  const clientName = `${client.firstName}`.trim() || 'Klient';
  const portalUrl = client.portalToken ? buildPortalUrl(client.portalToken) : null;

  const offerBriefs: OfferBrief[] = ordered.map(toOfferBrief);
  const voice = buildClientVoice({
    clientId: client.id,
    firstName: client.firstName,
    salutation: client.salutation,
    agentName,
  });
  // Sól wersji: kolejne wysyłki do tego samego klienta dostają inne sformułowania.
  const copy = offerEmailCopy(voice, {
    count: offerBriefs.length,
    firstTitle: offerBriefs[0]?.title,
    salt: offerIds.join('-'),
  });

  const intro = params.customMessage?.trim() || copy.intro;
  const subject = copy.subject;

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
    voice,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
  });

  return {
    subject,
    html,
    intro,
    voice,
    eyebrow: copy.eyebrow,
    headline: copy.headline,
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

async function claimClientMatchNotification(params: {
  clientId: number;
  offerId: number;
  score: number;
  now: Date;
  intelligence?: { reason: string };
}): Promise<boolean> {
  const existing = await prisma.agencyClientMatch.findUnique({
    where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
    select: { id: true, notifiedAt: true },
  });
  if (existing?.notifiedAt) return false;

  const intelPatch = params.intelligence
    ? { intelligenceSent: true, intelligenceReason: params.intelligence.reason }
    : {};

  if (existing) {
    const updated = await prisma.agencyClientMatch.updateMany({
      where: { id: existing.id, notifiedAt: null },
      data: {
        score: params.score,
        notifiedAt: params.now,
        sharedAt: params.now,
        ...intelPatch,
      },
    });
    return updated.count === 1;
  }

  try {
    await prisma.agencyClientMatch.create({
      data: {
        clientId: params.clientId,
        offerId: params.offerId,
        score: params.score,
        notifiedAt: params.now,
        sharedAt: params.now,
        intelligenceSent: Boolean(params.intelligence),
        intelligenceReason: params.intelligence?.reason ?? null,
      },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

export async function notifyAgencyClientAboutOffer(params: {
  clientId: number;
  offerId: number;
  agencyUserId: number;
  channel: 'email' | 'manual';
  customMessage?: string;
  skipIfNotified?: boolean;
  matchScore?: number;
  intelligence?: { reason: string };
  /** Agent właśnie zobaczył i zatwierdził tę propozycję. */
  approved?: boolean;
}) {
  const preview = await buildAgencyClientEmailPreview({
    clientId: params.clientId,
    offerIds: [params.offerId],
    agencyUserId: params.agencyUserId,
    customMessage: params.customMessage,
  });

  // Bez akceptacji agenta oferta nie trafia ani do panelu, ani na maila — czeka w „Do wysłania”.
  if (!params.approved && !(await isClientAutoSendAllowed(params.clientId, 'offer'))) {
    const existing = await prisma.agencyClientMatch.findUnique({
      where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
      select: { notifiedAt: true },
    });
    if (existing?.notifiedAt && params.skipIfNotified !== false) {
      return { emailSent: false, offerUrl: `https://estateos.pl/oferta/${params.offerId}`, alreadyNotified: true };
    }
    const wantsEmailLater = params.channel === 'email' && Boolean(preview.clientEmail);
    const queued = await deliverToClient({
      agencyUserId: params.agencyUserId,
      clientId: params.clientId,
      category: 'offer',
      source: params.intelligence ? 'intelligence_offer' : 'offer',
      steps: [
        {
          kind: 'action',
          name: 'notifyOffer',
          params: {
            clientId: params.clientId,
            offerId: params.offerId,
            agencyUserId: params.agencyUserId,
            channel: params.channel,
            customMessage: params.customMessage,
            skipIfNotified: params.skipIfNotified,
            matchScore: params.matchScore,
            intelligence: params.intelligence,
          },
        },
      ],
      preview: {
        subject: preview.subject,
        html: wantsEmailLater ? preview.html : null,
        text: wantsEmailLater
          ? null
          : `Propozycja w panelu klienta: ${preview.offers[0]?.title || 'oferta'}${params.customMessage ? `\n\n${params.customMessage}` : ''}`,
        recipient: wantsEmailLater ? preview.clientEmail : null,
        channels: wantsEmailLater ? ['email', 'push'] : ['push'],
      },
    });
    return {
      emailSent: false,
      queued: true,
      outboxId: queued.outboxId,
      offerUrl: `https://estateos.pl/oferta/${params.offerId}`,
      preview,
    };
  }

  const now = new Date();
  const score = await resolveClientMatchScore({
    clientId: params.clientId,
    offerId: params.offerId,
    matchScore: params.matchScore,
  });

  if (params.skipIfNotified !== false) {
    const claimed = await claimClientMatchNotification({
      clientId: params.clientId,
      offerId: params.offerId,
      score,
      now,
      intelligence: params.intelligence,
    });
    if (!claimed) {
      return { emailSent: false, offerUrl: `https://estateos.pl/oferta/${params.offerId}`, alreadyNotified: true };
    }
  } else {
    await prisma.agencyClientMatch.upsert({
      where: { clientId_offerId: { clientId: params.clientId, offerId: params.offerId } },
      create: {
        clientId: params.clientId,
        offerId: params.offerId,
        score,
        notifiedAt: now,
        sharedAt: now,
        intelligenceSent: Boolean(params.intelligence),
        intelligenceReason: params.intelligence?.reason ?? null,
      },
      update: {
        score: score > 0 ? score : undefined,
        notifiedAt: now,
        sharedAt: now,
        ...(params.intelligence
          ? { intelligenceSent: true, intelligenceReason: params.intelligence.reason }
          : {}),
      },
    });
  }

  const wantsEmail = params.channel === 'email' && Boolean(preview.clientEmail);
  const delivery = await deliverToClient({
    agencyUserId: params.agencyUserId,
    clientId: params.clientId,
    category: 'offer',
    source: params.intelligence ? 'intelligence_offer' : 'offer',
    approved: params.approved,
    steps: [
      ...(wantsEmail
        ? [
            emailStep({
              from: `"${preview.agentName} · ${preview.agencyName}" <powiadomienia@estateos.pl>`,
              to: preview.clientEmail as string,
              replyTo: preview.agentEmail || undefined,
              subject: preview.subject,
              html: preview.html,
            }),
          ]
        : []),
      {
        kind: 'push' as const,
        clientId: params.clientId,
        payload: {
          ...offerPushCopy(preview.voice, { count: 1, firstTitle: preview.offers[0]?.title, agentName: preview.agentName }),
          tag: `estateos-client-offer-${params.clientId}-${params.offerId}`,
          url: preview.portalUrl || undefined,
        },
      },
    ],
  });
  const emailSent = delivery.emailSent;
  if (delivery.sent && wantsEmail && !emailSent) {
    // Release the claim so the offer is not lost: it was never delivered.
    if (params.skipIfNotified !== false) {
      await prisma.agencyClientMatch
        .updateMany({
          where: { clientId: params.clientId, offerId: params.offerId, notifiedAt: now },
          data: {
            notifiedAt: null,
            sharedAt: null,
            ...(params.intelligence ? { intelligenceSent: false, intelligenceReason: null } : {}),
          },
        })
        .catch(() => {});
    }
    throw new Error('Nie udało się wysłać e-maila do klienta.');
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: params.clientId,
      agencyUserId: params.agencyUserId,
      offerId: params.offerId,
      kind: params.intelligence ? 'INTELLIGENCE_OFFER' : emailSent ? 'CLIENT_NOTIFIED' : 'OFFER_SHARED',
      title: params.intelligence
        ? `EstateOS™ Intelligence: ${preview.offers[0]?.title || 'ogłoszenie'}`
        : emailSent
          ? `Wysłano ofertę: ${preview.offers[0]?.title || 'ogłoszenie'}`
          : 'Zapisano udostępnienie oferty',
      body: [preview.intro, preview.offers[0] ? `${preview.offers[0].city}${preview.offers[0].district ? ` · ${preview.offers[0].district}` : ''}` : '']
        .filter(Boolean)
        .join('\n'),
      metadata: {
        channel: params.channel,
        emailSent,
        outboxId: delivery.outboxId,
        intelligence: Boolean(params.intelligence),
        intelligenceReason: params.intelligence?.reason || null,
        clientWhy: params.customMessage?.trim() || null,
        offerIds: [params.offerId],
        offers: preview.offers.map((o) => ({
          id: o.id,
          title: o.title,
          city: o.city,
          district: o.district,
          imageUrl: o.imageUrl || null,
        })),
      },
    },
  });

  if (params.intelligence) {
    await sendNotification({
      userId: params.agencyUserId,
      type: 'CRM_EVENT',
      title: delivery.queued
        ? `Propozycja czeka na akceptację: ${preview.offers[0]?.title || 'oferta'}`
        : `Asystent wysłał propozycję: ${preview.offers[0]?.title || 'oferta'}`,
      body: delivery.queued
        ? `${preview.clientName}: mail czeka na Twoją akceptację w „Dziś”.`
        : emailSent
        ? `${preview.clientName} dostał maila z propozycją.`
        : `${preview.clientName} ma nową propozycję w panelu (bez maila).`,
      data: crmAgentPushData(params.clientId, {
        kind: 'INTELLIGENCE_OFFER',
        offerId: params.offerId,
      }),
    }).catch(() => {});
  }

  return {
    emailSent,
    queued: delivery.queued,
    outboxId: delivery.outboxId,
    offerUrl: `https://estateos.pl/oferta/${params.offerId}`,
    preview,
  };
}

export async function notifyAgencyClientAboutOffers(params: {
  clientId: number;
  offerIds: number[];
  agencyUserId: number;
  channel: 'email' | 'manual';
  customMessage?: string;
  allowResend?: boolean;
  /** Agent właśnie zobaczył i zatwierdził podgląd. */
  approved?: boolean;
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
  const toSend = params.allowResend ? offerIds : offerIds.filter((id) => !blockedIds.has(id));

  if (!toSend.length && params.channel === 'email') {
    throw new Error('Wszystkie zaznaczone oferty zostały już wysłane tym klientowi.');
  }

  if (toSend.length && !params.approved && !(await isClientAutoSendAllowed(params.clientId, 'offer'))) {
    const wantsEmailLater = params.channel === 'email' && Boolean(preview.clientEmail);
    const queued = await deliverToClient({
      agencyUserId: params.agencyUserId,
      clientId: params.clientId,
      category: 'offer',
      source: 'offers_manual',
      steps: [
        {
          kind: 'action',
          name: 'notifyOffers',
          params: {
            clientId: params.clientId,
            offerIds: toSend,
            agencyUserId: params.agencyUserId,
            channel: params.channel,
            customMessage: params.customMessage,
            allowResend: params.allowResend,
          },
        },
      ],
      preview: {
        subject: preview.subject,
        html: wantsEmailLater ? preview.html : null,
        text: wantsEmailLater
          ? null
          : `Propozycje w panelu klienta:\n${preview.offers
              .filter((o) => toSend.includes(o.id))
              .map((o) => `• ${o.title}`)
              .join('\n')}`,
        recipient: wantsEmailLater ? preview.clientEmail : null,
        channels: wantsEmailLater ? ['email', 'push'] : ['push'],
      },
    });
    return {
      emailSent: false,
      queued: true,
      outboxId: queued.outboxId,
      sentCount: 0,
      skippedCount: blockedIds.size,
      preview,
    };
  }

  let emailSent = false;
  let queuedOutboxId: number | null = null;
  const pushStep = {
    kind: 'push' as const,
    clientId: params.clientId,
    payload: {
      ...offerPushCopy(preview.voice, {
        count: toSend.length,
        firstTitle: preview.offers.find((o) => o.id === toSend[0])?.title,
        agentName: preview.agentName,
      }),
      tag: `estateos-client-offers-${params.clientId}`,
      url: preview.portalUrl || undefined,
    },
  };
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
      voice: preview.voice,
      ...(sendOffers.length === preview.offers.length ? { eyebrow: preview.eyebrow, headline: preview.headline } : {}),
    });
    const delivery = await deliverToClient({
      agencyUserId: params.agencyUserId,
      clientId: params.clientId,
      category: 'offer',
      source: 'offers_manual',
      approved: params.approved,
      steps: [
        emailStep({
          from: `"${preview.agentName} · ${preview.agencyName}" <powiadomienia@estateos.pl>`,
          to: preview.clientEmail,
          replyTo: preview.agentEmail || undefined,
          subject: preview.subject,
          html: sendPreview,
        }),
        pushStep,
      ],
    });
    if (delivery.sent && !delivery.emailSent) throw new Error('Nie udało się wysłać e-maila do klienta.');
    emailSent = delivery.emailSent;
    queuedOutboxId = delivery.outboxId;
  } else if (toSend.length) {
    const delivery = await deliverToClient({
      agencyUserId: params.agencyUserId,
      clientId: params.clientId,
      category: 'offer',
      source: 'offers_manual',
      approved: params.approved,
      steps: [pushStep],
    });
    queuedOutboxId = delivery.outboxId;
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
      title: emailSent
        ? `Wysłano ${toSend.length} ${toSend.length === 1 ? 'ofertę' : 'ofert'} e-mailem`
        : `Udostępniono ${toSend.length} ofert`,
      body: [
        preview.intro,
        preview.offers
          .filter((o) => toSend.includes(o.id))
          .map((o) => `${o.title} · ${[o.city, o.district].filter(Boolean).join(', ')}`)
          .join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n'),
      metadata: {
        channel: params.channel,
        emailSent,
        outboxId: queuedOutboxId,
        offerIds: toSend,
        offers: preview.offers
          .filter((o) => toSend.includes(o.id))
          .map((o) => ({
            id: o.id,
            title: o.title,
            city: o.city,
            district: o.district,
            imageUrl: o.imageUrl || null,
          })),
      },
    },
  });

  return {
    emailSent,
    queued: queuedOutboxId != null,
    outboxId: queuedOutboxId,
    sentCount: toSend.length,
    skippedCount: blockedIds.size,
    preview,
  };
}

const FEEDBACK_REMIND_AFTER_MS = 36 * 60 * 60 * 1000;
const FEEDBACK_REMIND_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

export async function remindPendingClientFeedback(): Promise<{ scanned: number; reminded: number }> {
  const cutoff = new Date(Date.now() - FEEDBACK_REMIND_AFTER_MS);
  const stale = await prisma.agencyClientMatch.findMany({
    where: {
      notifiedAt: { lte: cutoff },
      clientFeedback: null,
      client: {
        status: 'ACTIVE',
        type: 'BUYER',
        portalToken: { not: null },
      },
    },
    include: {
      offer: {
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
      },
      client: {
        select: {
          id: true,
          firstName: true,
          salutation: true,
          email: true,
          portalToken: true,
          agencyUserId: true,
          linkedUserId: true,
        },
      },
    },
    orderBy: { notifiedAt: 'asc' },
    take: 80,
  });

  const byClient = new Map<number, typeof stale>();
  for (const row of stale) {
    const list = byClient.get(row.clientId) || [];
    list.push(row);
    byClient.set(row.clientId, list);
  }

  let reminded = 0;
  const cooldown = new Date(Date.now() - FEEDBACK_REMIND_COOLDOWN_MS);
  for (const [clientId, rows] of byClient) {
    const recent = await prisma.agencyClientActivity.findFirst({
      where: { clientId, kind: 'FEEDBACK_REMINDER', createdAt: { gte: cooldown } },
      select: { id: true },
    });
    if (recent) continue;
    const first = rows[0];
    if (!first?.client.portalToken) continue;

    const agent = await prisma.user.findUnique({
      where: { id: first.client.agencyUserId },
      select: { name: true, companyName: true, email: true, phone: true },
    });
    if (!agent) continue;

    const agentName = resolveSellerPersonName(agent) || agent.name || 'Twój agent';
    const agencyName = agent.companyName?.trim() || 'EstateOS';
    const clientName = first.client.firstName?.trim() || 'Klient';
    const portalUrl = buildPortalUrl(first.client.portalToken);
    const briefs = rows.slice(0, 4).map((row) => toOfferBrief(row.offer));
    const waiting = rows.length;
    const voice = buildClientVoice({
      clientId,
      firstName: first.client.firstName,
      salutation: first.client.salutation,
      agentName,
    });
    const copy = reminderCopy(voice, {
      waiting,
      firstTitle: first.offer.title,
      agentName,
      salt: rows.map((row) => row.offerId).join('-'),
    });
    const intro = copy.intro;

    let via: 'email' | 'portal' = 'portal';
    const reminderTitle = copy.pushTitle;
    const reminderSteps: OutboxStep[] = [];
    if (first.client.email) {
      const html = buildEmailHtml({
        agencyName,
        agentName,
        clientName,
        intro,
        offers: briefs,
        portalUrl,
        portalToken: first.client.portalToken,
        agentPhone: agent.phone,
        agentEmail: agent.email,
        voice,
        eyebrow: copy.eyebrow,
        headline: copy.headline,
      });
      reminderSteps.push(
        emailStep({
          from: `"${agentName} · ${agencyName}" <powiadomienia@estateos.pl>`,
          to: first.client.email,
          replyTo: agent.email || undefined,
          subject: copy.subject,
          html,
        }),
      );
      via = 'email';
    }

    if (first.client.linkedUserId) {
      reminderSteps.push({
        kind: 'notify',
        userId: first.client.linkedUserId,
        title: reminderTitle,
        body: copy.pushBody,
        data: {
          kind: 'CLIENT_PORTAL',
          portalToken: first.client.portalToken,
          deeplink: portalUrl,
          url: portalUrl,
        },
      });
    }

    reminderSteps.push({
      kind: 'push',
      clientId,
      payload: {
        title: reminderTitle,
        body: copy.pushBody,
        tag: `estateos-client-feedback-${clientId}`,
        url: portalUrl,
        native: !first.client.linkedUserId,
      },
    });

    // Przypomnienie powstaje automatycznie — czeka na akceptację agenta, chyba że pozwolił wysyłać takie samodzielnie.
    const reminderDelivery = await deliverToClient({
      agencyUserId: first.client.agencyUserId,
      clientId,
      category: 'reminder',
      source: 'feedback_reminder',
      steps: reminderSteps,
    });

    await prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId: first.client.agencyUserId,
        offerId: first.offerId,
        kind: 'FEEDBACK_REMINDER',
        title:
          waiting === 1
            ? `Przypomnienie: czekamy na opinię — ${first.offer.title}`
            : `Przypomnienie: ${waiting} oferty bez odpowiedzi klienta`,
        body: rows
          .slice(0, 6)
          .map((row) => row.offer.title)
          .join('\n'),
        metadata: {
          offerIds: rows.map((row) => row.offerId),
          waiting,
          via,
          outboxId: reminderDelivery.outboxId,
        },
      },
    });

    if (reminderDelivery.queued) {
      reminded += 1;
      continue;
    }

    await sendNotification({
      userId: first.client.agencyUserId,
      type: 'CRM_EVENT',
      title: `Przypomnienie do klienta: ${clientName}`,
      body:
        via === 'email'
          ? waiting === 1
            ? `Wysłano mail z prośbą o opinię przy ofercie ${first.offer.title}.`
            : `Wysłano mail: ${waiting} propozycje nadal bez odpowiedzi.`
          : `Brak maila — przypomnienie w panelu${first.client.linkedUserId ? ' i w aplikacji' : ''}.`,
      data: crmAgentPushData(clientId, { kind: 'FEEDBACK_REMINDER' }),
    }).catch(() => {});

    reminded += 1;
  }

  return { scanned: byClient.size, reminded };
}
