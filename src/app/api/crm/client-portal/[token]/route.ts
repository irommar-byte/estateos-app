import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { resolveSellerPersonName } from '@/lib/sellerDisplay';
import { buyerPrefToWebRadarFilters } from '@/lib/agencyClientShape';
import { formatRadarSummary } from '@/lib/radarCalibrationWeb';
import { contactThreadPair } from '@/lib/contactThreadPair';
import { sendContactThreadMessage } from '@/lib/contactSendMessage';
import type { AcquisitionFormData } from '@/lib/acquisitionWorkflow';

type RouteCtx = { params: Promise<{ token: string }> };

function shapeSearchCriteria(pref: Parameters<typeof buyerPrefToWebRadarFilters>[0]) {
  if (!pref) return null;
  const filters = buyerPrefToWebRadarFilters(pref);
  const summary = formatRadarSummary(filters);
  const amenities = [
    filters.requireBalcony ? 'Balkon' : null,
    filters.requireGarden ? 'Ogródek' : null,
    filters.requireElevator ? 'Winda' : null,
    filters.requireParking ? 'Parking' : null,
    filters.requireFurnished ? 'Umeblowane' : null,
  ].filter(Boolean) as string[];
  return {
    ...summary,
    districts: filters.selectedDistricts,
    amenities,
    calibrationMode: filters.calibrationMode,
  };
}

async function ensureAgencyClientThread(agencyUserId: number, linkedUserId: number) {
  const pair = contactThreadPair(agencyUserId, linkedUserId);
  return prisma.contactThread.upsert({
    where: { userLowId_userHighId: pair },
    update: {},
    create: pair,
    select: { id: true },
  });
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: 'ACTIVE' },
    include: {
      agencyUser: {
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          email: true,
          image: true,
          agencyMembership: {
            select: {
              agentTitle: true,
              profilePhotoUrl: true,
              company: {
                select: {
                  name: true,
                  slug: true,
                  logoUrl: true,
                  officePhone: true,
                  officeEmail: true,
                  website: true,
                  address: true,
                },
              },
            },
          },
        },
      },
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
      acquisition: {
        select: {
          id: true,
          status: true,
          currentStep: true,
          formData: true,
          agreementSnapshot: true,
          clientAcknowledgedAt: true,
          clientAcknowledgementName: true,
          signedAt: true,
          signerName: true,
          documentHash: true,
          copyEmailSentAt: true,
          updatedAt: true,
        },
      },
      activities: {
        where: {
          kind: {
            in: [
              'LISTING_LINKED',
              'CLIENT_NOTIFIED',
              'OFFER_SHARED',
              'ACQUISITION_MEETING',
              'ACQUISITION_SIGNED',
            ],
          },
        },
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
  const member = agent.agencyMembership;
  const company = member?.company;

  const agentName = resolveSellerPersonName(agent) || agent.name || 'Dedykowany Agent';
  const agentPhoto = member?.profilePhotoUrl || agent.image || null;
  const agentTitle = member?.agentTitle ? String(member.agentTitle) : 'Dedykowany Doradca d/s Nieruchomości';
  const agencyName = company?.name || agent.companyName || 'EstateOS Biuro Nieruchomości';
  const agencyLogo = company?.logoUrl || null;
  const agencySlug = company?.slug ? `/firma/${company.slug}` : null;
  const agencyWebsite = company?.website || null;
  const agencyPhone = company?.officePhone || agent.phone || null;
  const agencyEmail = company?.officeEmail || agent.email || null;
  const agencyAddress = company?.address || null;

  const searchCriteria = client.buyerPreference ? shapeSearchCriteria(client.buyerPreference) : null;
  const canChat = Boolean(client.linkedUserId);

  return NextResponse.json({
    success: true,
    portal: {
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      type: client.type,
      agencyName,
      agentName,
      agentPhone: agent.phone,
      agentEmail: agent.email,
      agentPhoto,
      agentTitle,
      agencyLogo,
      agencySlug,
      agencyWebsite,
      agencyPhone,
      agencyEmail,
      agencyAddress,
      searchCriteria,
      canChat,
      matches: client.buyerPreference
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
      acquisition: client.acquisition
        ? {
            status: client.acquisition.status,
            currentStep: client.acquisition.currentStep,
            formData: client.acquisition.formData as unknown as AcquisitionFormData,
            agreementSnapshot: client.acquisition.agreementSnapshot,
            clientAcknowledgedAt: client.acquisition.clientAcknowledgedAt?.toISOString() ?? null,
            clientAcknowledgementName: client.acquisition.clientAcknowledgementName,
            signedAt: client.acquisition.signedAt?.toISOString() ?? null,
            signerName: client.acquisition.signerName,
            documentHash: client.acquisition.documentHash,
            copyEmailSentAt: client.acquisition.copyEmailSentAt?.toISOString() ?? null,
            updatedAt: client.acquisition.updatedAt.toISOString(),
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
    where: { portalToken: token, status: 'ACTIVE' },
    select: {
      id: true,
      type: true,
      agencyUserId: true,
      linkedUserId: true,
      firstName: true,
      lastName: true,
      acquisition: {
        select: {
          id: true,
          status: true,
          formData: true,
          clientAcknowledgedAt: true,
        },
      },
    },
  });
  if (!client) {
    return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
  }

  if (action === 'update_acquisition_checklist') {
    if (client.type !== 'SELLER' || !client.acquisition || client.acquisition.status === 'SIGNED') {
      return NextResponse.json({ error: 'Proces pozyskania nie jest dostępny do edycji.' }, { status: 400 });
    }
    const incoming = body.documents && typeof body.documents === 'object' ? body.documents : {};
    const currentForm = client.acquisition.formData as unknown as AcquisitionFormData;
    const documents = Object.fromEntries(
      Object.entries(incoming)
        .slice(0, 30)
        .map(([key, value]) => [String(key).slice(0, 64), Boolean(value)]),
    );
    await prisma.agencyClientAcquisition.update({
      where: { id: client.acquisition.id },
      data: { formData: { ...currentForm, documents } },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'acknowledge_acquisition') {
    if (client.type !== 'SELLER' || !client.acquisition || !['TERMS_READY', 'IN_MEETING'].includes(client.acquisition.status)) {
      return NextResponse.json({ error: 'Warunki nie są jeszcze gotowe do potwierdzenia.' }, { status: 400 });
    }
    const acknowledgementName = String(body.name || '').trim();
    if (acknowledgementName.length < 3) {
      return NextResponse.json({ error: 'Wpisz imię i nazwisko.' }, { status: 400 });
    }
    const acknowledgedAt = new Date();
    await prisma.$transaction([
      prisma.agencyClientAcquisition.update({
        where: { id: client.acquisition.id },
        data: {
          clientAcknowledgedAt: acknowledgedAt,
          clientAcknowledgementName: acknowledgementName.slice(0, 191),
        },
      }),
      prisma.agencyClientActivity.create({
        data: {
          clientId: client.id,
          agencyUserId: client.agencyUserId,
          kind: 'ACQUISITION_ACKNOWLEDGED',
          title: 'Klient zapoznał się z warunkami',
          body: `${acknowledgementName} potwierdził(a) zapoznanie się z dokumentem.`,
          metadata: { acknowledgedAt: acknowledgedAt.toISOString(), via: 'client_portal' },
        },
      }),
    ]);
    return NextResponse.json({ success: true, acknowledgedAt: acknowledgedAt.toISOString() });
  }

  if (action === 'submit_feedback') {
    if (client.type !== 'BUYER') {
      return NextResponse.json({ error: 'Panel niedostępny.' }, { status: 404 });
    }
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

  if (action === 'list_messages' || action === 'send_message') {
    if (!client.linkedUserId) {
      return NextResponse.json(
        { error: 'Czat będzie dostępny po powiązaniu konta klienta z EstateOS.' },
        { status: 400 },
      );
    }

    const thread = await ensureAgencyClientThread(client.agencyUserId, client.linkedUserId);

    if (action === 'list_messages') {
      const messages = await prisma.contactMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          senderId: true,
          content: true,
          createdAt: true,
        },
      });
      return NextResponse.json({
        success: true,
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          fromAgent: m.senderId === client.agencyUserId,
          fromMe: m.senderId === client.linkedUserId,
        })),
      });
    }

    const content = String(body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'Wpisz treść wiadomości.' }, { status: 400 });
    }

    const result = await sendContactThreadMessage({
      threadId: thread.id,
      userId: client.linkedUserId,
      content,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: client.agencyUserId,
        kind: 'CLIENT_MESSAGE',
        title: 'Wiadomość od klienta',
        body: content.slice(0, 280),
        metadata: { threadId: thread.id, via: 'portal' },
      },
    });

    return NextResponse.json({ success: true, message: result.message });
  }

  return NextResponse.json({ error: 'Nieznana akcja.' }, { status: 400 });
}
