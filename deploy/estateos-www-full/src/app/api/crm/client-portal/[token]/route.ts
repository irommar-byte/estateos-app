import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    include: {
      agencyUser: { select: { name: true, companyName: true, phone: true, email: true } },
      buyerPreference: true,
      matches: {
        where: { notifiedAt: { not: null } },
        orderBy: { score: 'desc' },
        take: 50,
        include: {
          offer: {
            select: {
              id: true,
              title: true,
              price: true,
              priceCurrency: true,
              city: true,
              district: true,
              area: true,
              rooms: true,
              transactionType: true,
              status: true,
              managementStatus: true,
              images: true,
            },
          },
        },
      },
      linkedOffer: {
        select: {
          id: true,
          title: true,
          price: true,
          priceCurrency: true,
          city: true,
          district: true,
          status: true,
          managementStatus: true,
          images: true,
        },
      },
      activities: {
        where: { kind: { in: ['LISTING_LINKED', 'CLIENT_NOTIFIED', 'OFFER_SHARED'] } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, kind: true, title: true, body: true, createdAt: true, offerId: true },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: 'Nie znaleziono panelu klienta.' }, { status: 404 });
  }

  const agent = client.agencyUser;
  const agencyName = agent.companyName?.trim() || 'EstateOS';
  const agentName = resolveSellerPersonName(agent) || agent.name || agencyName;

  return NextResponse.json({
    success: true,
    portal: {
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      type: client.type,
      agencyName,
      agentName,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      matches:
        client.type === 'BUYER'
          ? client.matches.map((m) => ({
              id: m.id,
              score: m.score,
              notifiedAt: m.notifiedAt?.toISOString() ?? null,
              clientFeedback: m.clientFeedback,
              clientFeedbackAt: m.clientFeedbackAt?.toISOString() ?? null,
              offer: {
                id: m.offer.id,
                title: m.offer.title,
                price: m.offer.price,
                priceCurrency: m.offer.priceCurrency,
                city: m.offer.city,
                district: m.offer.district,
                area: m.offer.area,
                rooms: m.offer.rooms,
                imageUrl: resolveOfferPrimaryImage(m.offer),
              },
            }))
          : [],
      listing: client.linkedOffer
        ? {
            id: client.linkedOffer.id,
            title: client.linkedOffer.title,
            price: client.linkedOffer.price,
            priceCurrency: client.linkedOffer.priceCurrency,
            city: client.linkedOffer.city,
            district: client.linkedOffer.district,
            status: client.linkedOffer.status,
            managementStatus: client.linkedOffer.managementStatus,
            imageUrl: resolveOfferPrimaryImage(client.linkedOffer),
          }
        : null,
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

export async function POST(req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const body = await req.json();
  const action = String(body.action || '');

  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE', type: 'BUYER' },
  });
  if (!client) {
    return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  }

  if (action === 'submit_feedback') {
    const matchId = Number(body.matchId);
    const feedback = String(body.feedback || '').trim();
    if (!Number.isFinite(matchId) || !feedback) {
      return NextResponse.json({ error: 'Podaj komentarz do oferty.' }, { status: 400 });
    }

    const match = await prisma.agencyClientMatch.findFirst({
      where: { id: matchId, clientId: client.id },
      include: { offer: { select: { id: true, title: true } } },
    });
    if (!match) {
      return NextResponse.json({ error: 'Nie znaleziono dopasowania.' }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.agencyClientMatch.update({
        where: { id: matchId },
        data: { clientFeedback: feedback, clientFeedbackAt: new Date() },
      }),
      prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          offerId: match.offerId,
          kind: 'CLIENT_FEEDBACK',
          title: 'Uwagi klienta do oferty',
          body: feedback,
          metadata: { matchId, offerTitle: match.offer.title },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
