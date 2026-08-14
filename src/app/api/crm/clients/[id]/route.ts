import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAgencyClientForUser, requireAgencyUserId } from '@/lib/agencyClientAuth';
import {
  buyerPrefToWebRadarFilters,
  shapeClientListItem,
  webRadarFiltersToBuyerPrefCreate,
} from '@/lib/agencyClientShape';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import {
  notifyAgencyClientAboutOffer,
  notifyAgencyClientAboutOffers,
  buildAgencyClientEmailPreview,
  buildPortalUrl,
} from '@/lib/agencyClientNotify';
import { sendAgencyClientBusinessCard } from '@/lib/agencyClientBusinessCard';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { sendSMS } from '@/lib/sms';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { linkOfferToAgencyClient } from '@/lib/offerAgencyManagement';
import { parsePesel } from '@/lib/pesel';
import type { WebRadarFilters } from '@/lib/radarCalibrationWeb';

type RouteCtx = { params: Promise<{ id: string }> };

function normalizePhone(raw: unknown): string | null {
  const input = String(raw || '').trim();
  if (!input) return null;
  const normalized = input.replace(/[^\d+]/g, '');
  if (!normalized.startsWith('+') || normalized.length < 8) return null;
  return normalized;
}

export async function GET(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const client = await getAgencyClientForUser(clientId, agencyUserId);
  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    client: {
      ...shapeClientListItem(client),
      notes: client.notes,
      sellerTransactionType: client.sellerTransactionType,
      sellerPropertyType: client.sellerPropertyType,
      sellerCity: client.sellerCity,
      sellerDistrict: client.sellerDistrict,
      sellerPrice: client.sellerPrice,
      sellerArea: client.sellerArea,
      sellerRooms: client.sellerRooms,
      sellerDescription: client.sellerDescription,
      pesel: client.pesel,
      emailVerifiedAt: client.emailVerifiedAt?.toISOString() ?? null,
      phoneVerifiedAt: client.phoneVerifiedAt?.toISOString() ?? null,
      linkedOfferId: client.linkedOfferId,
      linkedUserId: client.linkedUserId,
      linkedUserEmail: client.linkedUser?.email ?? null,
      linkedUserLastLoginAt: client.linkedUser?.lastLoginAt?.toISOString() ?? null,
      portalToken: client.portalToken,
      portalUrl: client.portalToken ? buildPortalUrl(client.portalToken) : null,
      buyerFilters:
        client.type === 'BUYER'
          ? buyerPrefToWebRadarFilters(client.buyerPreference)
          : null,
      matches: client.matches.map((m) => ({
        id: m.id,
        score: m.score,
        notifiedAt: m.notifiedAt?.toISOString() ?? null,
        sharedAt: m.sharedAt?.toISOString() ?? null,
        clientFeedback: m.clientFeedback,
        clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
        offer: {
          id: m.offer.id,
          title: m.offer.title,
          price: m.offer.price,
          pricePln: m.offer.pricePln,
          priceCurrency: m.offer.priceCurrency,
          city: m.offer.city,
          district: m.offer.district,
          area: m.offer.area,
          rooms: m.offer.rooms,
          transactionType: m.offer.transactionType,
          imageUrl: resolveOfferPrimaryImage(m.offer),
        },
      })),
      activities: client.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        offerId: a.offerId,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const existing = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: 'ACTIVE' },
    include: { buyerPreference: true },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }

  const body = await req.json();
  const nextEmail = body.email !== undefined ? (body.email ? String(body.email).trim().toLowerCase() : null) : undefined;
  const nextPhone = body.phone !== undefined ? normalizePhone(body.phone) : undefined;
  if (body.phone !== undefined && body.phone && !nextPhone) {
    return NextResponse.json({ error: 'Telefon musi być w formacie międzynarodowym, np. +48501234567.' }, { status: 400 });
  }
  const nextPesel = body.pesel !== undefined ? (body.pesel ? String(body.pesel).trim() : null) : undefined;
  if (nextPesel && !parsePesel(nextPesel)) {
    return NextResponse.json({ error: 'Nieprawidłowy PESEL.' }, { status: 400 });
  }

  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      firstName: body.firstName != null ? String(body.firstName).trim() : undefined,
      lastName: body.lastName != null ? String(body.lastName).trim() : undefined,
      email: nextEmail,
      phone: nextPhone,
      pesel: nextPesel !== undefined ? (nextPesel ? nextPesel.replace(/\D/g, '') : null) : undefined,
      notes: body.notes !== undefined ? (body.notes ? String(body.notes).trim() : null) : undefined,
      ...(existing.type === 'SELLER'
        ? {
            sellerTransactionType: body.sellerTransactionType,
            sellerPropertyType: body.sellerPropertyType,
            sellerCity: body.sellerCity,
            sellerDistrict: body.sellerDistrict,
            sellerPrice: body.sellerPrice != null ? Number(body.sellerPrice) : undefined,
            sellerArea: body.sellerArea != null ? Number(body.sellerArea) : undefined,
            sellerRooms: body.sellerRooms != null ? Number(body.sellerRooms) : undefined,
            sellerDescription: body.sellerDescription,
          }
        : {}),
    },
  });

  if (nextEmail !== undefined) {
    if (nextEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
      if (existingUser) {
        await prisma.agencyClient.update({
          where: { id: clientId },
          data: { linkedUserId: existingUser.id },
        });
      } else {
        const createdUser = await prisma.user.create({
          data: {
            email: nextEmail,
            phone: nextPhone ?? undefined,
            name: `${body.firstName ?? existing.firstName} ${body.lastName ?? existing.lastName}`.trim(),
            role: 'USER',
          },
          select: { id: true },
        });
        await prisma.agencyClient.update({
          where: { id: clientId },
          data: { linkedUserId: createdUser.id },
        });
      }
    } else {
      await prisma.agencyClient.update({
        where: { id: clientId },
        data: { linkedUserId: null },
      });
    }
  }

  if (existing.type === 'BUYER' && body.buyerFilters) {
    const prefData = webRadarFiltersToBuyerPrefCreate(body.buyerFilters as WebRadarFilters);
    if (existing.buyerPreference) {
      await prisma.agencyClientBuyerPreference.update({
        where: { clientId },
        data: prefData,
      });
    } else {
      await prisma.agencyClientBuyerPreference.create({
        data: { clientId, ...prefData },
      });
    }
    await refreshAgencyClientMatches(clientId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const updated = await prisma.agencyClient.updateMany({
    where: { id: clientId, agencyUserId },
    data: { status: 'ARCHIVED' },
  });
  if (!updated.count) {
    return NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const body = await req.json();
  const action = String(body.action || '');

  if (action === 'refresh_matches') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, type: 'BUYER' },
    });
    if (!client) {
      return NextResponse.json({ error: 'Klient kupujący nie istnieje.' }, { status: 404 });
    }
    const result = await refreshAgencyClientMatches(clientId);
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'notify_offer') {
    const offerId = Number(body.offerId);
    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
    }
    const result = await notifyAgencyClientAboutOffer({
      clientId,
      offerId,
      agencyUserId,
      channel: body.channel === 'email' ? 'email' : 'manual',
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'preview_offers') {
    const offerIds = Array.isArray(body.offerIds)
      ? body.offerIds.map(Number).filter(Number.isFinite)
      : [Number(body.offerId)].filter(Number.isFinite);
    if (!offerIds.length) {
      return NextResponse.json({ error: 'Wybierz co najmniej jedną ofertę.' }, { status: 400 });
    }
    const preview = await buildAgencyClientEmailPreview({
      clientId,
      offerIds,
      agencyUserId,
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, preview });
  }

  if (action === 'notify_offers') {
    const offerIds = Array.isArray(body.offerIds)
      ? body.offerIds.map(Number).filter(Number.isFinite)
      : [];
    if (!offerIds.length) {
      return NextResponse.json({ error: 'Wybierz co najmniej jedną ofertę.' }, { status: 400 });
    }
    const result = await notifyAgencyClientAboutOffers({
      clientId,
      offerIds,
      agencyUserId,
      channel: body.channel === 'email' ? 'email' : 'manual',
      customMessage: body.message,
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'send_business_card') {
    try {
      const result = await sendAgencyClientBusinessCard({
        clientId,
        agencyUserId,
        customMessage: typeof body.message === 'string' ? body.message : undefined,
      });
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się wysłać wizytówki.';
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (action === 'link_offer') {
    const offerId = Number(body.offerId);
    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
    }
    const result = await linkOfferToAgencyClient({ agencyUserId, clientId, offerId });
    return NextResponse.json({ success: true, ...result });
  }

  if (action === 'send_email_code') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, firstName: true, email: true },
    });
    if (!client?.email) {
      return NextResponse.json({ error: 'Brak e-maila klienta.' }, { status: 400 });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { emailVerifyCode: code, emailVerifyExpiresAt: expires },
    });
    await sendTransactionalEmail({
      to: client.email,
      subject: 'Kod weryfikacji e-mail — EstateOS CRM',
      html: `<div style="font-family:Arial,sans-serif"><h2>Weryfikacja e-mail</h2><p>Twój kod: <strong style="font-size:24px;letter-spacing:4px">${code}</strong></p><p>Kod ważny 10 minut.</p></div>`,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'verify_email_code') {
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Podaj kod e-mail.' }, { status: 400 });
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, emailVerifyCode: true, emailVerifyExpiresAt: true },
    });
    if (!client || client.emailVerifyCode !== code) {
      return NextResponse.json({ error: 'Nieprawidłowy kod.' }, { status: 400 });
    }
    if (client.emailVerifyExpiresAt && new Date() > client.emailVerifyExpiresAt) {
      return NextResponse.json({ error: 'Kod wygasł. Wyślij nowy.' }, { status: 400 });
    }
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { emailVerifiedAt: new Date(), emailVerifyCode: null, emailVerifyExpiresAt: null },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'send_sms_code') {
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, phone: true },
    });
    if (!client?.phone) {
      return NextResponse.json({ error: 'Brak telefonu klienta.' }, { status: 400 });
    }
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { smsVerifyCode: code, smsVerifyExpiresAt: expires },
    });
    await sendSMS(client.phone, `Kod EstateOS CRM: ${code}`);
    return NextResponse.json({ success: true });
  }

  if (action === 'verify_sms_code') {
    const code = String(body.code || '').trim();
    if (!code) return NextResponse.json({ error: 'Podaj kod SMS.' }, { status: 400 });
    const client = await prisma.agencyClient.findFirst({
      where: { id: clientId, agencyUserId, status: 'ACTIVE' },
      select: { id: true, smsVerifyCode: true, smsVerifyExpiresAt: true },
    });
    if (!client || client.smsVerifyCode !== code) {
      return NextResponse.json({ error: 'Nieprawidłowy kod SMS.' }, { status: 400 });
    }
    if (client.smsVerifyExpiresAt && new Date() > client.smsVerifyExpiresAt) {
      return NextResponse.json({ error: 'Kod SMS wygasł. Wyślij nowy.' }, { status: 400 });
    }
    await prisma.agencyClient.update({
      where: { id: clientId },
      data: { phoneVerifiedAt: new Date(), smsVerifyCode: null, smsVerifyExpiresAt: null },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
